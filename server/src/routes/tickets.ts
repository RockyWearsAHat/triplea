import type { Request, Response, Router } from "express";
import express from "express";
import { Types } from "mongoose";
import { Ticket } from "../models/Ticket";
import { Gig } from "../models/Gig";
import { Location } from "../models/Location";
import { User } from "../models/User";
import { sendTicketConfirmationEmail } from "../lib/email";

const router: Router = express.Router();

// Purchase tickets for a concert
// POST /api/tickets/purchase
router.post("/purchase", async (req: Request, res: Response) => {
  try {
    const { gigId, quantity, email, holderName } = req.body as {
      gigId: string;
      quantity: number;
      email: string;
      holderName: string;
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
      return res.status(400).json({ message: "This is not a ticketed event" });
    }

    if (!gig.openForTickets) {
      return res
        .status(400)
        .json({ message: "Tickets are not available for this event" });
    }

    // Get user if authenticated
    const userId = (req as any).userId
      ? new Types.ObjectId((req as any).userId)
      : null;

    // Get ticket price (0 for free events)
    const pricePerTicket = gig.ticketPrice ?? 0;

    // Create the ticket
    const ticket = await (Ticket as any).createTicket({
      gigId: new Types.ObjectId(gigId),
      userId,
      email,
      holderName,
      quantity: qty,
      pricePerTicket,
    });

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
        createdAt: ticket.createdAt,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("POST /tickets/purchase error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

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
    const userId = (req as any).userId;
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
    const userId = (req as any).userId;
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
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Verify user has permission to scan tickets (host, admin, or employee)
    const user = await User.findById(userId).exec();
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const hasPermission =
      user.roles.includes("admin") ||
      user.roles.includes("customer") || // Hosts are customers who create events
      user.employeeRoles.length > 0;

    if (!hasPermission) {
      return res.status(403).json({ message: "Permission denied" });
    }

    const { qrPayload, gigId } = req.body as {
      qrPayload: string;
      gigId?: string;
    };

    if (!qrPayload) {
      return res.status(400).json({ message: "QR payload is required" });
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
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Verify user has permission
    const user = await User.findById(userId).exec();
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const hasPermission =
      user.roles.includes("admin") ||
      user.roles.includes("customer") ||
      user.employeeRoles.length > 0;

    if (!hasPermission) {
      return res.status(403).json({ message: "Permission denied" });
    }

    const { id } = req.params as { id: string };
    const ticket = await Ticket.findById(id).exec();

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
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
    const userId = (req as any).userId;
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
      })),
      stats,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("GET /tickets/gig/:gigId error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
