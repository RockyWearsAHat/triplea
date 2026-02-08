import type { Request, Response, Router } from "express";
import express from "express";
import Stripe from "stripe";
import { Types } from "mongoose";
import { Ticket } from "../models/Ticket";
import { Gig } from "../models/Gig";
import { Location } from "../models/Location";
import { TicketTier } from "../models/TicketTier";
import { SeatingLayout } from "../models/SeatingLayout";
import { sendTicketConfirmationEmail } from "../lib/email";
import { requireRole, type AuthenticatedRequest } from "../middleware/auth";
import { checkoutLimiter } from "../middleware/rateLimiter";

const router: Router = express.Router();

// Initialize Stripe with validated API key
function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(secretKey);
}

// Lazy initialization - only throw when actually needed
let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = getStripeClient();
  }
  return stripeClient;
}

function getMusicianOrigin(req: Request): string {
  return (
    req.get("origin") || process.env.MUSICIAN_ORIGIN || "http://localhost:5175"
  );
}

async function ensureStripeAccount(user: any): Promise<Stripe.Account> {
  if (user.stripeAccountId) {
    return await getStripe().accounts.retrieve(user.stripeAccountId);
  }

  const account = await getStripe().accounts.create({
    type: "express",
    country: "US",
    email: user.email,
    business_type: "individual",
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  user.stripeAccountId = account.id;
  user.stripeChargesEnabled = account.charges_enabled;
  user.stripePayoutsEnabled = account.payouts_enabled;
  user.stripeOnboardingComplete = account.details_submitted;
  await user.save();

  return account;
}

async function syncStripeAccountStatus(user: any, account: Stripe.Account) {
  user.stripeChargesEnabled = account.charges_enabled;
  user.stripePayoutsEnabled = account.payouts_enabled;
  user.stripeOnboardingComplete = account.details_submitted;
  await user.save();
}

// --- Musician Connect (payouts) ---
router.post(
  "/musicians/account",
  requireRole("musician"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.authUser!;
      const account = await ensureStripeAccount(user);
      await syncStripeAccountStatus(user, account);
      return res.json({
        stripeAccountId: user.stripeAccountId ?? null,
        chargesEnabled: user.stripeChargesEnabled ?? false,
        payoutsEnabled: user.stripePayoutsEnabled ?? false,
        detailsSubmitted: user.stripeOnboardingComplete ?? false,
        requirements: account.requirements?.currently_due ?? [],
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /stripe/musicians/account error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

router.post(
  "/musicians/onboarding-link",
  requireRole("musician"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.authUser!;
      const account = await ensureStripeAccount(user);
      const origin = getMusicianOrigin(req);
      const link = await getStripe().accountLinks.create({
        account: account.id,
        refresh_url: `${origin}/onboarding?step=stripe&refresh=true`,
        return_url: `${origin}/onboarding?step=stripe&return=true`,
        type: "account_onboarding",
      });

      return res.json({ url: link.url });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /stripe/musicians/onboarding-link error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

router.get(
  "/musicians/status",
  requireRole("musician"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.authUser!;
      if (!user.stripeAccountId) {
        return res.json({
          stripeAccountId: null,
          chargesEnabled: false,
          payoutsEnabled: false,
          detailsSubmitted: false,
          requirements: [],
        });
      }

      const account = await getStripe().accounts.retrieve(user.stripeAccountId);
      await syncStripeAccountStatus(user, account);

      return res.json({
        stripeAccountId: user.stripeAccountId ?? null,
        chargesEnabled: user.stripeChargesEnabled ?? false,
        payoutsEnabled: user.stripePayoutsEnabled ?? false,
        detailsSubmitted: user.stripeOnboardingComplete ?? false,
        requirements: account.requirements?.currently_due ?? [],
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("GET /stripe/musicians/status error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

/**
 * Parse a fee value from environment variable.
 * Supports:
 *   - Percentage: "1%", "1.5%", "2.9%" → returns { type: 'percent', value: 0.01 }
 *   - Flat amount: "0.50", "1", "2.00" → returns { type: 'flat', value: 50 } (in cents)
 */
function parseFeeConfig(
  envValue: string | undefined,
  defaultPercent: number,
): { type: "percent" | "flat"; value: number; display: string } {
  if (!envValue || envValue.trim() === "") {
    return {
      type: "percent",
      value: defaultPercent,
      display: `${(defaultPercent * 100).toFixed(2).replace(/\.?0+$/, "")}%`,
    };
  }

  let trimmed = envValue.trim();

  // Check if it's a percentage (ends with %)
  if (trimmed.endsWith("%")) {
    const numStr = trimmed.slice(0, -1).trim();
    const percent = parseFloat(numStr);
    if (isNaN(percent) || percent < 0 || percent > 100) {
      // Invalid, use default
      return {
        type: "percent",
        value: defaultPercent,
        display: `${(defaultPercent * 100).toFixed(2).replace(/\.?0+$/, "")}%`,
      };
    }
    // Round to 2 decimal places and convert to decimal
    const rounded = Math.round(percent * 100) / 10000;
    return {
      type: "percent",
      value: rounded,
      display: `${percent.toFixed(2).replace(/\.?0+$/, "")}%`,
    };
  }

  // Handle flat amount in dollars - strip leading $ if present
  if (trimmed.startsWith("$")) {
    trimmed = trimmed.slice(1).trim();
  }

  const dollarAmount = parseFloat(trimmed);
  if (isNaN(dollarAmount) || dollarAmount < 0) {
    // Invalid, use default
    return {
      type: "percent",
      value: defaultPercent,
      display: `${(defaultPercent * 100).toFixed(2).replace(/\.?0+$/, "")}%`,
    };
  }
  // Convert to cents
  const cents = Math.round(dollarAmount * 100);
  return {
    type: "flat",
    value: cents,
    display: `$${dollarAmount.toFixed(2).replace(/\.?0+$/, "")}`,
  };
}

function parseUSAddressForStripe(
  address: string | undefined,
  fallbackCity?: string,
): {
  line1: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country: string;
} | null {
  if (!address || !address.trim()) return null;

  // Expected seed format: "13 N 400 W, Salt Lake City, UT 84101"
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const line1 = parts[0] || "Event Venue";
  const city = parts[1] || fallbackCity;
  const tail = parts.slice(2).join(" ");
  const match = tail.match(/\b([A-Z]{2})\s+(\d{5})(?:-\d{4})?\b/);

  return {
    line1,
    city: city || undefined,
    state: match?.[1],
    postal_code: match?.[2],
    country: "US",
  };
}

async function estimateTaxCents(params: {
  currency: string;
  address: {
    line1: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country: string;
  };
  lineItems: Array<{ amountCents: number; reference: string }>;
}): Promise<number> {
  // Check if Stripe Tax is enabled via environment variable
  const taxEnabled = process.env.STRIPE_TAX_ENABLED === "true";
  if (!taxEnabled) {
    return 0;
  }

  // Stripe Tax requires a reasonably complete address.
  if (!params.address.state || !params.address.postal_code) {
    return 0;
  }

  try {
    const calculation = await (getStripe() as any).tax.calculations.create({
      currency: params.currency,
      customer_details: {
        address: params.address,
        address_source: "shipping",
      },
      line_items: params.lineItems.map((li) => ({
        amount: li.amountCents,
        reference: li.reference,
        tax_behavior: "exclusive",
      })),
    });

    const taxAmount =
      Number(
        (calculation as any).tax_amount_exclusive ??
          (calculation as any).tax_amount ??
          (calculation as any).amount_tax ??
          0,
      ) || 0;

    return Math.max(0, Math.round(taxAmount));
  } catch (err) {
    // Log the error for debugging, but don't fail the checkout
    // eslint-disable-next-line no-console
    console.warn(
      "Stripe Tax calculation failed:",
      err instanceof Error ? err.message : err,
    );
    return 0;
  }
}

// Fee configuration from environment
const platformFeeConfig = parseFeeConfig(
  process.env.PLATFORM_SERVICE_FEE,
  0.01,
); // Default 1%
const stripeFeePercentConfig = parseFeeConfig(
  process.env.STRIPE_FEE_PERCENT,
  0.029,
); // Default 2.9%
const stripeFeeFixedConfig = parseFeeConfig(
  process.env.STRIPE_FEE_FIXED,
  0.003,
); // Default $0.30 → 0.003 as decimal placeholder

// Stripe's fixed fee in cents (default 30 cents)
const STRIPE_FEE_FIXED =
  stripeFeeFixedConfig.type === "flat"
    ? stripeFeeFixedConfig.value
    : Math.round(stripeFeeFixedConfig.value * 10000); // If somehow percent, treat as cents

// Stripe's percentage fee as decimal
const STRIPE_FEE_PERCENT =
  stripeFeePercentConfig.type === "percent"
    ? stripeFeePercentConfig.value
    : 0.029;

// Fee charge mode: "transaction" (once per checkout) or "ticket" (per ticket)
const FEE_CHARGE_ON: "transaction" | "ticket" =
  process.env.FEE_CHARGE_ON === "ticket" ? "ticket" : "transaction";

/**
 * Calculate all fees for an order
 * @param subtotalCents - Base price in cents
 * @param quantity - Number of tickets (used for per-ticket fee calculation)
 * @returns Fee breakdown in cents
 */
export function calculateFees(
  subtotalCents: number,
  quantity: number = 1,
): {
  subtotal: number;
  serviceFee: number;
  stripeFee: number;
  total: number;
  serviceFeeDisplay: string;
  feeChargeMode: "transaction" | "ticket";
} {
  // Service fee calculation based on config type and charge mode
  let serviceFee: number;
  if (platformFeeConfig.type === "percent") {
    // Percentage fees are always calculated on subtotal (naturally scales with quantity)
    serviceFee = Math.round(subtotalCents * platformFeeConfig.value);
  } else {
    // Flat fee - apply per ticket or per transaction based on config
    serviceFee =
      FEE_CHARGE_ON === "ticket"
        ? platformFeeConfig.value * quantity
        : platformFeeConfig.value;
  }

  // Calculate what the total needs to be so that after Stripe takes their cut,
  // we receive the desired amount (subtotal + serviceFee)
  // Stripe formula: amount_received = total - (total * 2.9% + $0.30)
  // So: total = (amount_received + $0.30) / (1 - 2.9%)
  const desiredAmount = subtotalCents + serviceFee;
  const total = Math.ceil(
    (desiredAmount + STRIPE_FEE_FIXED) / (1 - STRIPE_FEE_PERCENT),
  );

  // The Stripe fee is what Stripe will take from the total
  const stripeFee = total - desiredAmount;

  return {
    subtotal: subtotalCents,
    serviceFee,
    stripeFee,
    total,
    serviceFeeDisplay: platformFeeConfig.display,
    feeChargeMode: FEE_CHARGE_ON,
  };
}

/**
 * Create a checkout session / payment intent
 * POST /api/stripe/create-checkout
 */
router.post(
  "/create-checkout",
  checkoutLimiter,
  async (req: Request, res: Response) => {
    try {
      const { gigId, quantity, email, holderName, tierId, seatIds } =
        req.body as {
          gigId: string;
          quantity: number;
          email: string;
          holderName: string;
          tierId?: string;
          seatIds?: string[];
        };

      // Validate inputs
      if (!gigId || !email || !holderName) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      if (!email.trim() || !email.includes("@")) {
        return res.status(400).json({ message: "Valid email is required" });
      }

      const qty = Number(quantity) || 1;
      if (qty < 1 || qty > 10) {
        return res
          .status(400)
          .json({ message: "Quantity must be between 1 and 10" });
      }

      // Find the gig/concert
      const gig = await Gig.findById(gigId).exec();
      if (!gig) {
        return res.status(404).json({ message: "Concert not found" });
      }

      if (gig.gigType !== "public-concert") {
        return res
          .status(400)
          .json({ message: "This is not a ticketed event" });
      }

      if (!gig.openForTickets) {
        return res
          .status(400)
          .json({ message: "Tickets are not available for this event" });
      }

      let pricePerTicket = gig.ticketPrice ?? 0;
      let tier = null;
      let tierName: string | undefined;

      // Handle tiered pricing
      if (tierId) {
        tier = await TicketTier.findById(tierId).exec();
        if (!tier) {
          return res.status(404).json({ message: "Ticket tier not found" });
        }
        if (String(tier.gigId) !== gigId) {
          return res
            .status(400)
            .json({ message: "Tier does not belong to this event" });
        }
        if (!tier.available) {
          return res
            .status(400)
            .json({ message: "This ticket tier is not available" });
        }
        if (tier.sold + qty > tier.capacity) {
          return res.status(400).json({
            message: `Only ${tier.capacity - tier.sold} tickets remaining in this tier`,
          });
        }
        pricePerTicket = tier.price;
        tierName = tier.name;
      }

      // Validate reserved seating
      if (gig.seatingType === "reserved" && gig.seatingLayoutId) {
        if (!seatIds || seatIds.length !== qty) {
          return res.status(400).json({
            message: `Please select exactly ${qty} seat(s) for this reserved seating event`,
          });
        }

        const layout = await SeatingLayout.findById(gig.seatingLayoutId).exec();
        if (!layout) {
          return res.status(500).json({ message: "Seating layout not found" });
        }

        // Verify all seats exist
        const seatMap = new Map(layout.seats.map((s) => [s.seatId, s]));
        for (const seatId of seatIds) {
          const seat = seatMap.get(seatId);
          if (!seat) {
            return res.status(400).json({ message: `Invalid seat: ${seatId}` });
          }
          if (!seat.isAvailable) {
            return res.status(400).json({
              message: `Seat ${seat.row}${seat.seatNumber} is not available`,
            });
          }
        }

        // Check for already sold seats
        const existingTickets = await Ticket.find({
          gigId: gig._id,
          status: { $in: ["valid", "used"] },
          "seatAssignments.seatId": { $in: seatIds },
        }).exec();

        if (existingTickets.length > 0) {
          return res.status(400).json({
            message: "One or more selected seats are no longer available",
          });
        }
      }

      // For free events, skip Stripe
      if (pricePerTicket === 0) {
        return res.status(400).json({
          message: "Free events do not require payment checkout",
        });
      }

      // Calculate amounts in cents
      const subtotalCents = Math.round(pricePerTicket * 100 * qty);
      const fees = calculateFees(subtotalCents, qty);

      // Get location info for description and tax calculation
      const location = gig.locationId
        ? await Location.findById(gig.locationId).exec()
        : null;

      const locationAddress = parseUSAddressForStripe(
        location?.address,
        location?.city,
      );

      // Calculate tax on subtotal + service fee + payment processing fee
      const taxCents = locationAddress
        ? await estimateTaxCents({
            currency: "usd",
            address: locationAddress,
            lineItems: [
              { amountCents: subtotalCents, reference: "tickets" },
              { amountCents: fees.serviceFee, reference: "service_fee" },
              { amountCents: fees.stripeFee, reference: "payment_processing" },
            ],
          })
        : 0;

      // Create a PaymentIntent with automatic tax calculation if enabled
      // Note: For Stripe Tax to work with PaymentIntents, you need to use
      // stripe.tax.calculations.create() first, then apply the tax amount.
      // For simplicity, we're using the calculated fees approach.
      // To enable full Stripe Tax with automatic remittance, use Checkout Sessions instead.
      const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
        amount: fees.total + taxCents,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          gigId,
          quantity: qty.toString(),
          email,
          holderName,
          pricePerTicketCents: (pricePerTicket * 100).toString(),
          subtotalCents: fees.subtotal.toString(),
          serviceFeeCents: fees.serviceFee.toString(),
          stripeFeeCents: fees.stripeFee.toString(),
          tierId: tierId || "",
          tierName: tierName || "",
          seatIds: seatIds ? JSON.stringify(seatIds) : "",
          locationAddress: locationAddress
            ? JSON.stringify(locationAddress)
            : "",
          taxCents: taxCents.toString(),
        },
        receipt_email: email,
        description: `${qty} ticket(s) to ${gig.title}${tierName ? ` (${tierName})` : ""}${location?.name ? ` at ${location.name}` : ""}`,
      };

      const paymentIntent =
        await getStripe().paymentIntents.create(paymentIntentParams);

      return res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        fees: {
          subtotal: fees.subtotal / 100,
          serviceFee: fees.serviceFee / 100,
          stripeFee: fees.stripeFee / 100,
          total: fees.total / 100,
          serviceFeeDisplay: fees.serviceFeeDisplay,
          feeChargeMode: fees.feeChargeMode,
          tax: taxCents / 100,
          totalWithTax: (fees.total + taxCents) / 100,
        },
        gig: {
          id: gig.id,
          title: gig.title,
          date: gig.date,
          time: gig.time,
          seatingType: gig.seatingType,
        },
        location: location
          ? {
              id: location.id,
              name: location.name,
            }
          : null,
        tier: tier
          ? {
              id: tier.id,
              name: tier.name,
              price: tier.price,
            }
          : null,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /stripe/create-checkout error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

/**
 * Confirm payment and create ticket
 * POST /api/stripe/confirm-payment
 */
router.post("/confirm-payment", async (req: Request, res: Response) => {
  try {
    const { paymentIntentId } = req.body as {
      paymentIntentId: string;
    };

    if (!paymentIntentId) {
      return res.status(400).json({ message: "Payment intent ID is required" });
    }

    // Retrieve the payment intent from Stripe
    const paymentIntent =
      await getStripe().paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({
        message: `Payment not completed. Status: ${paymentIntent.status}`,
      });
    }

    // Check if ticket already created for this payment
    const existingTicket = await Ticket.findOne({
      stripePaymentIntentId: paymentIntentId,
    }).exec();

    if (existingTicket) {
      return res.json({
        ticket: {
          id: existingTicket.id,
          confirmationCode: existingTicket.confirmationCode,
          gigId: existingTicket.gigId,
          quantity: existingTicket.quantity,
          pricePerTicket: existingTicket.pricePerTicket,
          totalPaid: existingTicket.totalPaid,
          status: existingTicket.status,
          holderName: existingTicket.holderName,
          email: existingTicket.email,
          tierId: existingTicket.tierId ? String(existingTicket.tierId) : null,
          tierName: existingTicket.tierName,
          seatAssignments: existingTicket.seatAssignments,
          createdAt: existingTicket.createdAt,
        },
      });
    }

    // Extract metadata
    const {
      gigId,
      quantity,
      email,
      holderName,
      pricePerTicketCents,
      serviceFeeCents,
      stripeFeeCents,
      tierId,
      tierName,
      seatIds: seatIdsJson,
    } = paymentIntent.metadata;

    const qty = Number(quantity) || 1;
    const pricePerTicket = Number(pricePerTicketCents) / 100;
    const serviceFee = Number(serviceFeeCents) / 100;
    const stripeFee = Number(stripeFeeCents) / 100;
    const totalPaid = paymentIntent.amount / 100;
    const seatIds = seatIdsJson ? JSON.parse(seatIdsJson) : [];

    // Get user if authenticated
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUser?.id
      ? new Types.ObjectId(authReq.authUser.id)
      : null;

    // Build seat assignments if applicable
    let seatAssignments: Array<{
      seatId: string;
      section: string;
      row: string;
      seatNumber: string;
    }> = [];

    const gig = await Gig.findById(gigId).exec();

    if (gig?.seatingLayoutId && seatIds.length > 0) {
      const layout = await SeatingLayout.findById(gig.seatingLayoutId).exec();
      if (layout) {
        const seatMap = new Map(layout.seats.map((s) => [s.seatId, s]));
        for (const seatId of seatIds) {
          const seat = seatMap.get(seatId);
          if (seat) {
            seatAssignments.push({
              seatId: seat.seatId,
              section: seat.section,
              row: seat.row,
              seatNumber: seat.seatNumber,
            });
          }
        }
      }
    }

    // Create the ticket with Stripe payment info
    const ticket = await (Ticket as any).createTicketWithPayment({
      gigId: new Types.ObjectId(gigId),
      userId,
      email,
      holderName,
      quantity: qty,
      pricePerTicket,
      totalPaid,
      serviceFee,
      stripeFee,
      stripePaymentIntentId: paymentIntentId,
    });

    // Add tier and seat information
    if (tierId) {
      ticket.tierId = new Types.ObjectId(tierId);
      ticket.tierName = tierName;
      // Update tier sold count
      const tier = await TicketTier.findById(tierId).exec();
      if (tier) {
        tier.sold += qty;
        await tier.save();
      }
    }
    if (seatAssignments.length > 0) {
      ticket.seatAssignments = seatAssignments;
    }
    await ticket.save();

    // Get location for email
    const location = gig?.locationId
      ? await Location.findById(gig.locationId).exec()
      : null;

    // Send confirmation email
    if (gig) {
      await sendTicketConfirmationEmail({
        ticket,
        gig,
        locationName: location?.name,
      });
    }

    return res.status(201).json({
      ticket: {
        id: ticket.id,
        confirmationCode: ticket.confirmationCode,
        gigId: ticket.gigId,
        quantity: ticket.quantity,
        pricePerTicket: ticket.pricePerTicket,
        totalPaid: ticket.totalPaid,
        serviceFee: ticket.serviceFee,
        stripeFee: ticket.stripeFee,
        status: ticket.status,
        holderName: ticket.holderName,
        email: ticket.email,
        tierId: ticket.tierId ? String(ticket.tierId) : null,
        tierName: ticket.tierName,
        seatAssignments: ticket.seatAssignments,
        createdAt: ticket.createdAt,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("POST /stripe/confirm-payment error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Get fee calculation preview (for display before checkout)
 * POST /api/stripe/calculate-fees
 */
router.post("/calculate-fees", async (req: Request, res: Response) => {
  try {
    const { gigId, quantity, tierId } = req.body as {
      gigId: string;
      quantity: number;
      tierId?: string;
    };

    if (!gigId) {
      return res.status(400).json({ message: "Gig ID is required" });
    }

    const qty = Number(quantity) || 1;

    // Find the gig/concert
    const gig = await Gig.findById(gigId).exec();
    if (!gig) {
      return res.status(404).json({ message: "Concert not found" });
    }

    let pricePerTicket = gig.ticketPrice ?? 0;

    // If tiered pricing is in use, use tier price for accurate fees
    if (tierId) {
      const tier = await TicketTier.findById(tierId).exec();
      if (tier && String(tier.gigId) === gigId && tier.available) {
        pricePerTicket = tier.price;
      }
    }

    // For free events, no fees
    if (pricePerTicket === 0) {
      return res.json({
        subtotal: 0,
        serviceFee: 0,
        stripeFee: 0,
        total: 0,
        isFree: true,
        serviceFeeDisplay: platformFeeConfig.display,
        feeChargeMode: FEE_CHARGE_ON,
      });
    }

    // Calculate amounts in cents then convert to dollars
    const subtotalCents = Math.round(pricePerTicket * 100 * qty);
    const fees = calculateFees(subtotalCents, qty);

    const location = gig.locationId
      ? await Location.findById(gig.locationId).exec()
      : null;
    const locationAddress = parseUSAddressForStripe(
      location?.address,
      location?.city,
    );

    // Calculate tax on subtotal + service fee + payment processing fee
    const taxCents = locationAddress
      ? await estimateTaxCents({
          currency: "usd",
          address: locationAddress,
          lineItems: [
            { amountCents: subtotalCents, reference: "tickets" },
            { amountCents: fees.serviceFee, reference: "service_fee" },
            { amountCents: fees.stripeFee, reference: "payment_processing" },
          ],
        })
      : 0;

    return res.json({
      subtotal: fees.subtotal / 100,
      serviceFee: fees.serviceFee / 100,
      stripeFee: fees.stripeFee / 100,
      total: fees.total / 100,
      isFree: false,
      serviceFeeDisplay: fees.serviceFeeDisplay,
      feeChargeMode: fees.feeChargeMode,
      tax: taxCents / 100,
      totalWithTax: (fees.total + taxCents) / 100,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("POST /stripe/calculate-fees error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Stripe webhook handler for payment events
 * POST /api/stripe/webhook
 */
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      // eslint-disable-next-line no-console
      console.warn("STRIPE_WEBHOOK_SECRET not configured");
      return res.status(400).json({ message: "Webhook not configured" });
    }

    let event: Stripe.Event;

    try {
      event = getStripe().webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Webhook signature verification failed:", err);
      return res.status(400).json({ message: "Webhook signature invalid" });
    }

    // Handle the event
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        // eslint-disable-next-line no-console
        console.log(`PaymentIntent ${paymentIntent.id} succeeded`);
        // Ticket creation is handled in confirm-payment endpoint
        break;
      }
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        // eslint-disable-next-line no-console
        console.log(`PaymentIntent ${paymentIntent.id} failed`);
        break;
      }
      default:
        // eslint-disable-next-line no-console
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.json({ received: true });
  },
);

/**
 * Create a Stripe Checkout Session with automatic tax
 * This uses Stripe's hosted checkout page with built-in tax calculation
 * POST /api/stripe/create-checkout-session
 */
router.post("/create-checkout-session", async (req: Request, res: Response) => {
  try {
    const { gigId, quantity, email, holderName, tierId, seatIds } =
      req.body as {
        gigId: string;
        quantity: number;
        email: string;
        holderName: string;
        tierId?: string;
        seatIds?: string[];
      };

    // Validate inputs
    if (!gigId || !email || !holderName) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const qty = Number(quantity) || 1;
    if (qty < 1 || qty > 10) {
      return res
        .status(400)
        .json({ message: "Quantity must be between 1 and 10" });
    }

    // Find the gig/concert
    const gig = await Gig.findById(gigId).exec();
    if (!gig) {
      return res.status(404).json({ message: "Concert not found" });
    }

    if (!gig.openForTickets) {
      return res
        .status(400)
        .json({ message: "Tickets are not available for this event" });
    }

    let pricePerTicket = gig.ticketPrice ?? 0;
    let tierName: string | undefined;

    // Handle tiered pricing
    if (tierId) {
      const tier = await TicketTier.findById(tierId).exec();
      if (tier && String(tier.gigId) === gigId && tier.available) {
        pricePerTicket = tier.price;
        tierName = tier.name;
      }
    }

    // For free events, skip Stripe
    if (pricePerTicket === 0) {
      return res.status(400).json({
        message: "Free events do not require payment checkout",
      });
    }

    // Get location info
    const location = gig.locationId
      ? await Location.findById(gig.locationId).exec()
      : null;

    // Calculate service fee
    const subtotalCents = Math.round(pricePerTicket * 100 * qty);
    const fees = calculateFees(subtotalCents);

    // Create Stripe Checkout Session with automatic tax
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      // Enable automatic tax calculation and remittance
      automatic_tax: {
        enabled: true,
      },
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${gig.title}${tierName ? ` (${tierName})` : ""}`,
              description: `${qty} ticket(s)${location?.name ? ` at ${location.name}` : ""}`,
            },
            unit_amount: Math.round(pricePerTicket * 100),
            tax_behavior: "exclusive", // Tax will be added on top
          },
          quantity: qty,
        },
        // Service fee as a separate line item
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Service Fee",
              description: `Platform service fee (${fees.serviceFeeDisplay})`,
            },
            unit_amount: Math.round(fees.serviceFee),
            tax_behavior: "exclusive",
          },
          quantity: 1,
        },
      ],
      metadata: {
        gigId,
        quantity: qty.toString(),
        email,
        holderName,
        tierId: tierId || "",
        tierName: tierName || "",
        seatIds: seatIds ? JSON.stringify(seatIds) : "",
      },
      success_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/cart`,
    });

    return res.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("POST /stripe/create-checkout-session error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
