import type { Request, Response, Router } from "express";
import express from "express";
import { Types } from "mongoose";
import { Ticket } from "../models/Ticket";
import { Gig } from "../models/Gig";
import { Location } from "../models/Location";
import { User } from "../models/User";
import { TicketTier } from "../models/TicketTier";
import { SeatingLayout } from "../models/SeatingLayout";
import { sendTicketConfirmationEmail } from "../lib/email";
import type { AuthenticatedRequest } from "../middleware/auth";
import {
  scanTicketSchema,
  validateBody,
  formatZodErrors,
} from "../lib/validation";
import { checkoutLimiter } from "../middleware/rateLimiter";

const router: Router = express.Router();

/**
 * Helper to check if user can scan tickets for a given gig
 * Returns true if user is admin, employee, or the gig creator
 */
async function canScanTicketsForGig(
  user: { roles: string[]; employeeRoles: string[] },
  userId: string,
  gigId: string | undefined,
): Promise<boolean> {
  // Admins can always scan
  if (user.roles.includes("admin")) {
    return true;
  }

  // Employees can scan
  if (user.employeeRoles.length > 0) {
    return true;
  }

  // If no gigId specified, only admins/employees can scan
  if (!gigId) {
    return false;
  }

  // Check if user is the event creator (host)
  if (!Types.ObjectId.isValid(gigId)) {
    return false;
  }

  const gig = await Gig.findById(gigId).exec();
  if (!gig) {
    return false;
  }

  return String(gig.createdByUserId) === userId;
}

// Purchase tickets for a concert
// POST /api/tickets/purchase
router.post(
  "/purchase",
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

      // Get user if authenticated
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.authUser?.id
        ? new Types.ObjectId(authReq.authUser.id)
        : null;

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

      // Handle reserved seating
      let seatAssignments: Array<{
        seatId: string;
        section: string;
        row: string;
        seatNumber: string;
      }> = [];

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

        // Verify all seats exist and are available
        const seatMap = new Map(layout.seats.map((s) => [s.seatId, s]));

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
          seatAssignments.push({
            seatId: seat.seatId,
            section: seat.section,
            row: seat.row,
            seatNumber: seat.seatNumber,
          });
        }
      }

      // Create the ticket
      const ticket = await (Ticket as any).createTicket({
        gigId: new Types.ObjectId(gigId),
        userId,
        email,
        holderName,
        quantity: qty,
        pricePerTicket,
      });

      // Add tier and seat information if applicable
      if (tier) {
        ticket.tierId = tier._id;
        ticket.tierName = tierName;
        // Increment sold count
        tier.sold += qty;
        await tier.save();
      }
      if (seatAssignments.length > 0) {
        ticket.seatAssignments = seatAssignments;
      }
      await ticket.save();

      // Get location for email
      const location = gig.locationId
        ? await Location.findById(gig.locationId).exec()
        : null;

      // Send confirmation email
      await sendTicketConfirmationEmail({
        ticket,
        gig,
        locationName: location?.name,
      });

      return res.status(201).json({
        ticket: {
          id: ticket.id,
          confirmationCode: ticket.confirmationCode,
          gigId: ticket.gigId,
          quantity: ticket.quantity,
          pricePerTicket: ticket.pricePerTicket,
          totalPaid: ticket.totalPaid,
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
      console.error("POST /tickets/purchase error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

// Get ticket by confirmation code (public - for viewing ticket)
// GET /api/tickets/confirm/:code
router.get("/confirm/:code", async (req: Request, res: Response) => {
  try {
    const { code } = req.params as { code: string };

    const ticket = await Ticket.findOne({ confirmationCode: code }).exec();
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const gig = await Gig.findById(ticket.gigId).exec();
    const location = gig?.locationId
      ? await Location.findById(gig.locationId).exec()
      : null;

    return res.json({
      ticket: {
        id: ticket.id,
        confirmationCode: ticket.confirmationCode,
        quantity: ticket.quantity,
        pricePerTicket: ticket.pricePerTicket,
        totalPaid: ticket.totalPaid,
        status: ticket.status,
        holderName: ticket.holderName,
        createdAt: ticket.createdAt,
      },
      gig: gig
        ? {
            id: gig.id,
            title: gig.title,
            date: gig.date,
            time: gig.time,
            description: gig.description,
          }
        : null,
      location: location
        ? {
            id: location.id,
            name: location.name,
            address: location.address,
            city: location.city,
          }
        : null,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("GET /tickets/confirm/:code error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Get fresh QR code for a ticket (authenticated owner or by confirmation code)
// POST /api/tickets/:id/qr
router.post("/:id/qr", async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { confirmationCode } = req.body as { confirmationCode?: string };

    let ticket;

    // Find ticket by ID or confirmation code
    if (Types.ObjectId.isValid(id)) {
      ticket = await Ticket.findById(id).exec();
    }

    if (!ticket && confirmationCode) {
      ticket = await Ticket.findOne({ confirmationCode }).exec();
    }

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Verify ownership if user is logged in
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUser?.id;
    if (userId && ticket.userId && ticket.userId.toString() !== userId) {
      // If logged in user doesn't own this ticket, require confirmation code
      if (!confirmationCode || confirmationCode !== ticket.confirmationCode) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    // Check ticket status
    if (ticket.status !== "valid") {
      return res.status(400).json({
        message: `Ticket is ${ticket.status}`,
        status: ticket.status,
      });
    }

    // Rotate QR token
    (ticket as any).rotateQrToken();
    await ticket.save();

    // Generate QR payload
    const qrPayload = (ticket as any).generateQrPayload();

    return res.json({
      qrPayload,
      expiresAt: ticket.qrTokenExpiresAt.toISOString(),
      status: ticket.status,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("POST /tickets/:id/qr error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Get my tickets (authenticated user)
// GET /api/tickets/mine
router.get("/mine", async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUser?.id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const tickets = await Ticket.find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();

    // Get gig and location details for each ticket
    const gigIds = [...new Set(tickets.map((t) => t.gigId.toString()))];
    const gigs = await Gig.find({ _id: { $in: gigIds } }).exec();
    const gigById = new Map(gigs.map((g) => [g.id, g]));

    const locationIds = gigs
      .filter((g) => g.locationId)
      .map((g) => g.locationId!.toString());
    const locations = locationIds.length
      ? await Location.find({ _id: { $in: locationIds } }).exec()
      : [];
    const locationById = new Map(locations.map((l) => [l.id, l]));

    return res.json({
      tickets: tickets.map((t) => {
        const gig = gigById.get(t.gigId.toString());
        const location = gig?.locationId
          ? locationById.get(gig.locationId.toString())
          : null;

        return {
          id: t.id,
          confirmationCode: t.confirmationCode,
          quantity: t.quantity,
          pricePerTicket: t.pricePerTicket,
          totalPaid: t.totalPaid,
          status: t.status,
          holderName: t.holderName,
          usedAt: t.usedAt,
          createdAt: t.createdAt,
          gig: gig
            ? {
                id: gig.id,
                title: gig.title,
                date: gig.date,
                time: gig.time,
              }
            : null,
          location: location
            ? {
                id: location.id,
                name: location.name,
                city: location.city,
              }
            : null,
        };
      }),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("GET /tickets/mine error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Scan/validate a ticket (host/employee only)
// POST /api/tickets/scan
router.post("/scan", async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUser?.id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Validate input
    const validation = validateBody(scanTicketSchema, req.body);
    if (!validation.success) {
      return res
        .status(400)
        .json({ message: formatZodErrors(validation.errors) });
    }

    const { qrPayload, gigId } = validation.data;

    // Verify user exists
    const user = await User.findById(userId).exec();
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Check permission - must be admin, employee, or event creator
    const hasPermission = await canScanTicketsForGig(
      { roles: user.roles, employeeRoles: user.employeeRoles },
      userId,
      gigId,
    );

    if (!hasPermission) {
      return res.status(403).json({
        message: gigId
          ? "Permission denied. You can only scan tickets for your own events."
          : "Permission denied. Select an event to scan tickets.",
      });
    }

    // Verify the QR payload
    const result = await (Ticket as any).verifyQrPayload(qrPayload);

    if (!result.valid) {
      return res.status(400).json({
        valid: false,
        message: result.error,
      });
    }

    const ticket = result.ticket!;

    // If gigId is specified, verify ticket is for this event
    if (gigId && ticket.gigId.toString() !== gigId) {
      return res.status(400).json({
        valid: false,
        message: "This ticket is for a different event",
      });
    }

    // Get gig details
    const gig = await Gig.findById(ticket.gigId).exec();

    return res.json({
      valid: true,
      ticket: {
        id: ticket.id,
        confirmationCode: ticket.confirmationCode,
        quantity: ticket.quantity,
        holderName: ticket.holderName,
        status: ticket.status,
      },
      gig: gig
        ? {
            id: gig.id,
            title: gig.title,
            date: gig.date,
            time: gig.time,
          }
        : null,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("POST /tickets/scan error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Mark ticket as used (complete the scan)
// POST /api/tickets/:id/use
router.post("/:id/use", async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUser?.id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Validate ObjectId format
    const { id } = req.params as { id: string };
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ticket ID format" });
    }

    // Verify user exists
    const user = await User.findById(userId).exec();
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const ticket = await Ticket.findById(id).exec();
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Check permission - must be admin, employee, or event creator
    const hasPermission = await canScanTicketsForGig(
      { roles: user.roles, employeeRoles: user.employeeRoles },
      userId,
      String(ticket.gigId),
    );

    if (!hasPermission) {
      return res.status(403).json({
        message:
          "Permission denied. You can only scan tickets for your own events.",
      });
    }

    if (ticket.status !== "valid") {
    }

    if (ticket.status !== "valid") {
      return res.status(400).json({
        message: `Ticket is already ${ticket.status}`,
        status: ticket.status,
      });
    }

    // Mark ticket as used
    ticket.status = "used";
    ticket.usedAt = new Date();
    ticket.scannedByUserId = new Types.ObjectId(userId);
    await ticket.save();

    return res.json({
      success: true,
      ticket: {
        id: ticket.id,
        confirmationCode: ticket.confirmationCode,
        status: ticket.status,
        usedAt: ticket.usedAt,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("POST /tickets/:id/use error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Get tickets for a specific gig (host/admin only - for event management)
// GET /api/tickets/gig/:gigId
router.get("/gig/:gigId", async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUser?.id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { gigId } = req.params as { gigId: string };

    // Verify the gig exists and user has access
    const gig = await Gig.findById(gigId).exec();
    if (!gig) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if user is the event creator or admin
    const user = await User.findById(userId).exec();
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const isOwner = gig.createdByUserId.toString() === userId;
    const isAdmin = user.roles.includes("admin");

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Permission denied" });
    }

    const tickets = await Ticket.find({ gigId: new Types.ObjectId(gigId) })
      .sort({ createdAt: -1 })
      .exec();

    const stats = {
      total: tickets.reduce((sum, t) => sum + t.quantity, 0),
      valid: tickets
        .filter((t) => t.status === "valid")
        .reduce((sum, t) => sum + t.quantity, 0),
      used: tickets
        .filter((t) => t.status === "used")
        .reduce((sum, t) => sum + t.quantity, 0),
      cancelled: tickets
        .filter((t) => t.status === "cancelled")
        .reduce((sum, t) => sum + t.quantity, 0),
      revenue: tickets.reduce((sum, t) => sum + t.totalPaid, 0),
    };

    return res.json({
      tickets: tickets.map((t) => ({
        id: t.id,
        confirmationCode: t.confirmationCode,
        quantity: t.quantity,
        holderName: t.holderName,
        email: t.email,
        totalPaid: t.totalPaid,
        status: t.status,
        usedAt: t.usedAt,
        createdAt: t.createdAt,
        tierName: t.tierName,
        seatAssignments: t.seatAssignments,
        isComped: t.totalPaid === 0 && t.pricePerTicket === 0,
        issuedByHost: (t as any).issuedByHost ?? false,
      })),
      stats,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("GET /tickets/gig/:gigId error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Issue/send tickets to a specific email (host/admin only)
// POST /api/tickets/issue
// Use cases:
// 1. Send comp tickets (free tickets for VIPs, sponsors, etc.)
// 2. Generate one-time tickets for walk-ins/special guests
// 3. Transfer tickets to a specific person by email
router.post("/issue", async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUser?.id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const {
      gigId,
      email,
      holderName,
      quantity = 1,
      tierId,
      seatIds,
      sendEmail: shouldSendEmail = true,
      note,
      isComp = false,
    } = req.body as {
      gigId: string;
      email: string;
      holderName: string;
      quantity?: number;
      tierId?: string;
      seatIds?: string[];
      sendEmail?: boolean;
      note?: string;
      isComp?: boolean;
    };

    // Validate inputs
    if (!gigId || !email || !holderName) {
      return res
        .status(400)
        .json({ message: "Missing required fields: gigId, email, holderName" });
    }

    const qty = Number(quantity) || 1;
    if (qty < 1 || qty > 50) {
      return res
        .status(400)
        .json({ message: "Quantity must be between 1 and 50" });
    }

    // Find the gig
    const gig = await Gig.findById(gigId).exec();
    if (!gig) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if user has permission (must be event creator or admin)
    const user = await User.findById(userId).exec();
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const isOwner = gig.createdByUserId.toString() === userId;
    const isAdmin = user.roles.includes("admin");

    if (!isOwner && !isAdmin) {
      return res
        .status(403)
        .json({
          message:
            "Permission denied. Only the event host or admin can issue tickets.",
        });
    }

    // Look up recipient user by email (optional - they may not have an account)
    const recipientUser = await User.findOne({
      email: email.toLowerCase().trim(),
    }).exec();

    let pricePerTicket = isComp ? 0 : (gig.ticketPrice ?? 0);
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
      pricePerTicket = isComp ? 0 : tier.price;
      tierName = tier.name;
    }

    // Handle reserved seating
    let seatAssignments: Array<{
      seatId: string;
      section: string;
      row: string;
      seatNumber: string;
    }> = [];

    if (gig.seatingType === "reserved" && gig.seatingLayoutId) {
      if (seatIds && seatIds.length > 0) {
        if (seatIds.length !== qty) {
          return res.status(400).json({
            message: `Please select exactly ${qty} seat(s) for reserved seating`,
          });
        }

        const layout = await SeatingLayout.findById(gig.seatingLayoutId).exec();
        if (!layout) {
          return res.status(500).json({ message: "Seating layout not found" });
        }

        const seatMap = new Map(layout.seats.map((s) => [s.seatId, s]));

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
          seatAssignments.push({
            seatId: seat.seatId,
            section: seat.section,
            row: seat.row,
            seatNumber: seat.seatNumber,
          });
        }
      }
    }

    // Create the ticket
    const ticket = await (Ticket as any).createTicket({
      gigId: new Types.ObjectId(gigId),
      userId: recipientUser ? recipientUser._id : null,
      email: email.toLowerCase().trim(),
      holderName,
      quantity: qty,
      pricePerTicket,
    });

    // Set total paid to 0 for comped tickets
    if (isComp) {
      ticket.totalPaid = 0;
    }

    // Mark as issued by host
    (ticket as any).issuedByHost = true;
    (ticket as any).issuedByUserId = new Types.ObjectId(userId);
    (ticket as any).issueNote = note || undefined;

    // Add tier and seat information if applicable
    if (tier) {
      ticket.tierId = tier._id;
      ticket.tierName = tierName;
      // Increment sold count
      tier.sold += qty;
      await tier.save();
    }
    if (seatAssignments.length > 0) {
      ticket.seatAssignments = seatAssignments;
    }
    await ticket.save();

    // Get location for email
    const location = gig.locationId
      ? await Location.findById(gig.locationId).exec()
      : null;

    // Send email notification if requested
    if (shouldSendEmail) {
      const { sendIssuedTicketEmail } = await import("../lib/email");
      await sendIssuedTicketEmail({
        ticket,
        gig,
        locationName: location?.name,
        issuedByName: user.name,
        note,
        isComp,
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
        status: ticket.status,
        holderName: ticket.holderName,
        email: ticket.email,
        tierId: ticket.tierId ? String(ticket.tierId) : null,
        tierName: ticket.tierName,
        seatAssignments: ticket.seatAssignments,
        isComp,
        createdAt: ticket.createdAt,
      },
      emailSent: shouldSendEmail,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("POST /tickets/issue error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Cancel a ticket (host/admin only)
// POST /api/tickets/:id/cancel
router.post("/:id/cancel", async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUser?.id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { id } = req.params as { id: string };
    const { reason, sendEmail: shouldSendEmail = true } = req.body as {
      reason?: string;
      sendEmail?: boolean;
    };

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ticket ID format" });
    }

    const ticket = await Ticket.findById(id).exec();
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Get the gig to check permissions
    const gig = await Gig.findById(ticket.gigId).exec();
    if (!gig) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if user has permission
    const user = await User.findById(userId).exec();
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const isOwner = gig.createdByUserId.toString() === userId;
    const isAdmin = user.roles.includes("admin");

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Permission denied" });
    }

    if (ticket.status === "cancelled") {
      return res.status(400).json({ message: "Ticket is already cancelled" });
    }

    if (ticket.status === "used") {
      return res.status(400).json({ message: "Cannot cancel a used ticket" });
    }

    // If the ticket has a tier, decrement the sold count
    if (ticket.tierId) {
      const tier = await TicketTier.findById(ticket.tierId).exec();
      if (tier) {
        tier.sold = Math.max(0, tier.sold - ticket.quantity);
        await tier.save();
      }
    }

    // Cancel the ticket
    ticket.status = "cancelled";
    await ticket.save();

    // Send cancellation email if requested
    if (shouldSendEmail) {
      const location = gig.locationId
        ? await Location.findById(gig.locationId).exec()
        : null;
      const { sendTicketCancellationEmail } = await import("../lib/email");
      await sendTicketCancellationEmail({
        ticket,
        gig,
        locationName: location?.name,
        reason,
      });
    }

    return res.json({
      success: true,
      ticket: {
        id: ticket.id,
        confirmationCode: ticket.confirmationCode,
        status: ticket.status,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("POST /tickets/:id/cancel error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Resend ticket email (host/admin only)
// POST /api/tickets/:id/resend
router.post("/:id/resend", async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUser?.id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { id } = req.params as { id: string };

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ticket ID format" });
    }

    const ticket = await Ticket.findById(id).exec();
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Get the gig
    const gig = await Gig.findById(ticket.gigId).exec();
    if (!gig) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if user has permission
    const user = await User.findById(userId).exec();
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const isOwner = gig.createdByUserId.toString() === userId;
    const isAdmin = user.roles.includes("admin");

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Permission denied" });
    }

    if (ticket.status === "cancelled") {
      return res
        .status(400)
        .json({ message: "Cannot resend a cancelled ticket" });
    }

    // Get location for email
    const location = gig.locationId
      ? await Location.findById(gig.locationId).exec()
      : null;

    // Send the confirmation email
    await sendTicketConfirmationEmail({
      ticket,
      gig,
      locationName: location?.name,
    });

    return res.json({
      success: true,
      message: `Ticket email resent to ${ticket.email}`,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("POST /tickets/:id/resend error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
