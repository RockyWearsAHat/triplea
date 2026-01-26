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

const router: Router = express.Router();

// Initialize Stripe with API key from environment
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

// Fee configuration
const PLATFORM_FEE_PERCENT = 0.01; // 1% service fee
const STRIPE_FEE_PERCENT = 0.029; // 2.9%
const STRIPE_FEE_FIXED = 30; // 30 cents in cents

/**
 * Calculate all fees for an order
 * @param subtotalCents - Base price in cents
 * @returns Fee breakdown in cents
 */
export function calculateFees(subtotalCents: number): {
  subtotal: number;
  serviceFee: number;
  stripeFee: number;
  total: number;
} {
  // Service fee: 1% of subtotal
  const serviceFee = Math.round(subtotalCents * PLATFORM_FEE_PERCENT);

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
  };
}

/**
 * Create a checkout session / payment intent
 * POST /api/stripe/create-checkout
 */
router.post("/create-checkout", async (req: Request, res: Response) => {
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
      return res.status(400).json({ message: "This is not a ticketed event" });
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
    const fees = calculateFees(subtotalCents);

    // Get location name for description
    const location = gig.locationId
      ? await Location.findById(gig.locationId).exec()
      : null;

    // Create a PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: fees.total,
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
      },
      receipt_email: email,
      description: `${qty} ticket(s) to ${gig.title}${tierName ? ` (${tierName})` : ""}${location?.name ? ` at ${location.name}` : ""}`,
    });

    return res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      fees: {
        subtotal: fees.subtotal / 100,
        serviceFee: fees.serviceFee / 100,
        stripeFee: fees.stripeFee / 100,
        total: fees.total / 100,
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
});

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
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

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
    const userId = (req as any).userId
      ? new Types.ObjectId((req as any).userId)
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
    const { gigId, quantity } = req.body as {
      gigId: string;
      quantity: number;
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

    const pricePerTicket = gig.ticketPrice ?? 0;

    // For free events, no fees
    if (pricePerTicket === 0) {
      return res.json({
        subtotal: 0,
        serviceFee: 0,
        stripeFee: 0,
        total: 0,
        isFree: true,
      });
    }

    // Calculate amounts in cents then convert to dollars
    const subtotalCents = Math.round(pricePerTicket * 100 * qty);
    const fees = calculateFees(subtotalCents);

    return res.json({
      subtotal: fees.subtotal / 100,
      serviceFee: fees.serviceFee / 100,
      stripeFee: fees.stripeFee / 100,
      total: fees.total / 100,
      isFree: false,
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
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
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

export default router;
