import type { Response, Router } from "express";
import express from "express";
import mongoose from "mongoose";
import { requireRole, type AuthenticatedRequest } from "../middleware/auth";
import { Gig } from "../models/Gig";
import { TicketTier } from "../models/TicketTier";
import { SeatingLayout } from "../models/SeatingLayout";
import { Ticket } from "../models/Ticket";
import { Location } from "../models/Location";

const router: Router = express.Router();

// ==================== TICKET TIERS ====================

/**
 * Get ticket tiers for a gig
 * GET /api/seating/gigs/:gigId/tiers
 */
router.get("/gigs/:gigId/tiers", async (req, res: Response) => {
  try {
    const { gigId } = req.params as { gigId: string };

    const gig = await Gig.findById(gigId).exec();
    if (!gig) {
      return res.status(404).json({ message: "Gig not found" });
    }

    const tiers = await TicketTier.find({ gigId: gig._id })
      .sort({ sortOrder: 1 })
      .exec();

    return res.json({
      tiers: tiers.map((t) => ({
        id: t.id,
        gigId: String(t.gigId),
        name: t.name,
        description: t.description,
        tierType: t.tierType,
        price: t.price,
        capacity: t.capacity,
        sold: t.sold,
        remaining: Math.max(0, t.capacity - t.sold),
        available: t.available,
        sortOrder: t.sortOrder,
        color: t.color,
      })),
    });
  } catch (err) {
    console.error("GET /seating/gigs/:gigId/tiers error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Create a ticket tier for a gig (host only)
 * POST /api/seating/gigs/:gigId/tiers
 */
router.post(
  "/gigs/:gigId/tiers",
  requireRole("customer"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { gigId } = req.params as { gigId: string };
      const { name, description, tierType, price, capacity, color, sortOrder } =
        req.body as {
          name: string;
          description?: string;
          tierType?: string;
          price: number;
          capacity: number;
          color?: string;
          sortOrder?: number;
        };

      if (!name || typeof price !== "number" || typeof capacity !== "number") {
        return res
          .status(400)
          .json({ message: "name, price, and capacity are required" });
      }

      const gig = await Gig.findById(gigId).exec();
      if (!gig) {
        return res.status(404).json({ message: "Gig not found" });
      }

      // Verify ownership
      if (String(gig.createdByUserId) !== req.authUser!.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Get existing tier count for sort order
      const existingCount = await TicketTier.countDocuments({
        gigId: gig._id,
      }).exec();

      const tier = await TicketTier.create({
        gigId: gig._id,
        name,
        description,
        tierType: tierType || "general_admission",
        price,
        capacity,
        sold: 0,
        available: true,
        sortOrder: sortOrder ?? existingCount,
        color,
      });

      // Mark gig as having tiers
      if (!gig.hasTicketTiers) {
        gig.hasTicketTiers = true;
        await gig.save();
      }

      return res.status(201).json({
        tier: {
          id: tier.id,
          gigId: String(tier.gigId),
          name: tier.name,
          description: tier.description,
          tierType: tier.tierType,
          price: tier.price,
          capacity: tier.capacity,
          sold: tier.sold,
          remaining: tier.capacity,
          available: tier.available,
          sortOrder: tier.sortOrder,
          color: tier.color,
        },
      });
    } catch (err) {
      console.error("POST /seating/gigs/:gigId/tiers error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

/**
 * Update a ticket tier (host only)
 * PATCH /api/seating/tiers/:tierId
 */
router.patch(
  "/tiers/:tierId",
  requireRole("customer"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tierId } = req.params as { tierId: string };
      const updates = req.body as {
        name?: string;
        description?: string;
        price?: number;
        capacity?: number;
        available?: boolean;
        color?: string;
        sortOrder?: number;
      };

      const tier = await TicketTier.findById(tierId).exec();
      if (!tier) {
        return res.status(404).json({ message: "Tier not found" });
      }

      const gig = await Gig.findById(tier.gigId).exec();
      if (!gig || String(gig.createdByUserId) !== req.authUser!.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Apply updates
      if (updates.name !== undefined) tier.name = updates.name;
      if (updates.description !== undefined)
        tier.description = updates.description;
      if (updates.price !== undefined) tier.price = updates.price;
      if (updates.capacity !== undefined) {
        // Can't reduce capacity below sold
        if (updates.capacity < tier.sold) {
          return res.status(400).json({
            message: `Cannot reduce capacity below sold count (${tier.sold})`,
          });
        }
        tier.capacity = updates.capacity;
      }
      if (updates.available !== undefined) tier.available = updates.available;
      if (updates.color !== undefined) tier.color = updates.color;
      if (updates.sortOrder !== undefined) tier.sortOrder = updates.sortOrder;

      await tier.save();

      return res.json({
        tier: {
          id: tier.id,
          gigId: String(tier.gigId),
          name: tier.name,
          description: tier.description,
          tierType: tier.tierType,
          price: tier.price,
          capacity: tier.capacity,
          sold: tier.sold,
          remaining: Math.max(0, tier.capacity - tier.sold),
          available: tier.available,
          sortOrder: tier.sortOrder,
          color: tier.color,
        },
      });
    } catch (err) {
      console.error("PATCH /seating/tiers/:tierId error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

/**
 * Delete a ticket tier (host only, if no sales)
 * DELETE /api/seating/tiers/:tierId
 */
router.delete(
  "/tiers/:tierId",
  requireRole("customer"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tierId } = req.params as { tierId: string };

      const tier = await TicketTier.findById(tierId).exec();
      if (!tier) {
        return res.status(404).json({ message: "Tier not found" });
      }

      const gig = await Gig.findById(tier.gigId).exec();
      if (!gig || String(gig.createdByUserId) !== req.authUser!.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      if (tier.sold > 0) {
        return res.status(400).json({
          message: "Cannot delete tier with sold tickets",
        });
      }

      await tier.deleteOne();

      // Check if any tiers remain
      const remainingTiers = await TicketTier.countDocuments({
        gigId: gig._id,
      }).exec();
      if (remainingTiers === 0) {
        gig.hasTicketTiers = false;
        await gig.save();
      }

      return res.json({ success: true });
    } catch (err) {
      console.error("DELETE /seating/tiers/:tierId error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

// ==================== SEATING LAYOUTS ====================

/**
 * Get a seating layout by id (host only)
 * GET /api/seating/layouts/:layoutId
 */
router.get(
  "/layouts/:layoutId",
  requireRole("customer"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { layoutId } = req.params as { layoutId: string };

      const layout = await SeatingLayout.findById(layoutId).exec();
      if (!layout) {
        return res.status(404).json({ message: "Seating layout not found" });
      }

      if (String(layout.createdByUserId) !== req.authUser!.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      return res.json({
        layout: {
          id: layout.id,
          name: layout.name,
          locationId: String(layout.locationId),
          description: layout.description,
          totalCapacity: layout.totalCapacity,
          sections: layout.sections,
          seats: layout.seats,
          floors: (layout as any).floors,
          isTemplate: layout.isTemplate,
          stagePosition: layout.stagePosition,
          createdAt: layout.createdAt,
          updatedAt: layout.updatedAt,
        },
      });
    } catch (err) {
      console.error("GET /seating/layouts/:layoutId error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

/**
 * Create a seating layout template for a location (host only)
 * POST /api/seating/locations/:locationId/layouts
 */
router.post(
  "/locations/:locationId/layouts",
  requireRole("customer"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { locationId } = req.params as { locationId: string };
      const { name, sections, stagePosition, useSimpleLayout, description } =
        req.body as {
          name: string;
          description?: string;
          floors?: Array<{ floorId: string; name: string; order: number }>;
          sections?: Array<{
            name: string;
            rows: number;
            seatsPerRow: number;
            tierId?: string;
            color?: string;
          }>;
          stagePosition?: "top" | "bottom" | "left" | "right";
          useSimpleLayout?: boolean;
        };

      const location = await Location.findById(locationId).exec();
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }

      if (
        location.createdByUserId &&
        String(location.createdByUserId) !== req.authUser!.id
      ) {
        return res.status(403).json({ message: "Forbidden" });
      }

      let layout;

      if (useSimpleLayout && sections && sections.length > 0) {
        const sectionParams = sections.map((s) => ({
          name: s.name,
          rows: s.rows,
          seatsPerRow: s.seatsPerRow,
          tierId: s.tierId ? new mongoose.Types.ObjectId(s.tierId) : undefined,
          color: s.color,
        }));

        layout = (SeatingLayout as any).generateSimpleLayout({
          name: name || `${location.name} Seating`,
          locationId: new mongoose.Types.ObjectId(locationId),
          createdByUserId: new mongoose.Types.ObjectId(req.authUser!.id),
          sections: sectionParams,
        });

        layout.isTemplate = true;
        layout.description = description;
        if (stagePosition) layout.stagePosition = stagePosition;
        if ((req.body as any).floors)
          (layout as any).floors = (req.body as any).floors;
        await layout.save();
      } else {
        layout = await SeatingLayout.create({
          name: name || `${location.name} Seating`,
          locationId: new mongoose.Types.ObjectId(locationId),
          createdByUserId: new mongoose.Types.ObjectId(req.authUser!.id),
          description,
          totalCapacity: 0,
          sections: [],
          seats: [],
          floors: (req.body as any).floors,
          isTemplate: true,
          stagePosition: stagePosition || "top",
        });
      }

      return res.status(201).json({
        layout: {
          id: layout.id,
          name: layout.name,
          locationId: String(layout.locationId),
          description: layout.description,
          totalCapacity: layout.totalCapacity,
          sections: layout.sections,
          seats: layout.seats,
          floors: (layout as any).floors,
          isTemplate: layout.isTemplate,
          stagePosition: layout.stagePosition,
        },
      });
    } catch (err) {
      console.error("POST /seating/locations/:locationId/layouts error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

/**
 * Update a seating layout (host only)
 * PATCH /api/seating/layouts/:layoutId
 */
router.patch(
  "/layouts/:layoutId",
  requireRole("customer"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { layoutId } = req.params as { layoutId: string };
      const updates = req.body as {
        name?: string;
        description?: string;
        stagePosition?: "top" | "bottom" | "left" | "right";
        backgroundImageUrl?: string;
        stage?: {
          x: number;
          y: number;
          width: number;
          height: number;
          shape?: "rect" | "rounded";
          cornerRadius?: number;
        };
        sections?: any[];
        floors?: Array<{ floorId: string; name: string; order: number }>;
        elements?: Array<{
          elementId: string;
          type: "aisle";
          floorId?: string;
          orientation: "vertical" | "horizontal";
          x: number;
          y: number;
          length: number;
          thickness: number;
          label?: string;
        }>;
        seats?: Array<{
          seatId: string;
          row: string;
          seatNumber: string;
          section: string;
          floorId?: string;
          tierId?: string;
          posX?: number;
          posY?: number;
          isAvailable: boolean;
          accessibility?: string[];
          rowGroupId?: string;
          detachedFromRow?: boolean;
        }>;
      };

      const layout = await SeatingLayout.findById(layoutId).exec();
      if (!layout) {
        return res.status(404).json({ message: "Seating layout not found" });
      }

      if (String(layout.createdByUserId) !== req.authUser!.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      if (updates.name !== undefined) layout.name = updates.name;
      if (updates.description !== undefined)
        layout.description = updates.description;
      if (updates.stagePosition !== undefined)
        layout.stagePosition = updates.stagePosition;

      if (updates.backgroundImageUrl !== undefined) {
        (layout as any).backgroundImageUrl =
          typeof updates.backgroundImageUrl === "string" &&
          updates.backgroundImageUrl.trim() !== ""
            ? updates.backgroundImageUrl.trim()
            : undefined;
      }

      if (updates.stage !== undefined) {
        (layout as any).stage = updates.stage;
      }

      if (updates.floors) {
        // Basic validation only
        const seen = new Set<string>();
        for (const f of updates.floors) {
          if (!f || typeof f.floorId !== "string" || f.floorId.trim() === "") {
            return res
              .status(400)
              .json({ message: "Each floor must have a floorId" });
          }
          if (seen.has(f.floorId)) {
            return res
              .status(400)
              .json({ message: `Duplicate floorId: ${f.floorId}` });
          }
          seen.add(f.floorId);
        }
        (layout as any).floors = updates.floors;
      }

      if (updates.elements) {
        const elementIds = new Set<string>();
        for (const el of updates.elements) {
          if (
            !el ||
            typeof el.elementId !== "string" ||
            el.elementId.trim() === ""
          ) {
            return res
              .status(400)
              .json({ message: "Each element must have an elementId" });
          }
          if (elementIds.has(el.elementId)) {
            return res
              .status(400)
              .json({ message: `Duplicate elementId: ${el.elementId}` });
          }
          elementIds.add(el.elementId);
        }
        (layout as any).elements = updates.elements;
      }

      if (updates.seats) {
        const floors = (updates.floors ??
          (layout as any).floors ??
          []) as Array<{
          floorId: string;
          name: string;
          order: number;
        }>;
        const fallbackFloorId = floors[0]?.floorId ?? "floor-1";

        const seatIds = new Set<string>();
        for (const seat of updates.seats) {
          if (
            !seat ||
            typeof seat.seatId !== "string" ||
            seat.seatId.trim() === ""
          ) {
            return res
              .status(400)
              .json({ message: "Each seat must have a seatId" });
          }
          if (seatIds.has(seat.seatId)) {
            return res
              .status(400)
              .json({ message: `Duplicate seatId: ${seat.seatId}` });
          }
          seatIds.add(seat.seatId);
        }

        layout.seats = updates.seats.map((s) => ({
          seatId: s.seatId,
          row: s.row,
          seatNumber: s.seatNumber,
          section: s.section,
          floorId: s.floorId || fallbackFloorId,
          tierId: s.tierId ? new mongoose.Types.ObjectId(s.tierId) : undefined,
          posX: s.posX,
          posY: s.posY,
          isAvailable: !!s.isAvailable,
          accessibility: s.accessibility,
          rowGroupId: s.rowGroupId,
          detachedFromRow: !!s.detachedFromRow,
        }));

        layout.totalCapacity = layout.seats.length;
      }

      if (updates.sections) {
        // Trust client for now; sections are descriptive and can be regenerated.
        layout.sections = updates.sections as any;
      }

      await layout.save();

      return res.json({
        layout: {
          id: layout.id,
          name: layout.name,
          locationId: String(layout.locationId),
          description: layout.description,
          totalCapacity: layout.totalCapacity,
          sections: layout.sections,
          seats: layout.seats,
          floors: (layout as any).floors,
          elements: (layout as any).elements,
          backgroundImageUrl: (layout as any).backgroundImageUrl,
          stage: (layout as any).stage,
          isTemplate: layout.isTemplate,
          stagePosition: layout.stagePosition,
          createdAt: layout.createdAt,
          updatedAt: layout.updatedAt,
        },
      });
    } catch (err) {
      console.error("PATCH /seating/layouts/:layoutId error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

/**
 * Get seating layout for a gig
 * GET /api/seating/gigs/:gigId/layout
 */
router.get("/gigs/:gigId/layout", async (req, res: Response) => {
  try {
    const { gigId } = req.params as { gigId: string };

    const gig = await Gig.findById(gigId).exec();
    if (!gig) {
      return res.status(404).json({ message: "Gig not found" });
    }

    if (!gig.seatingLayoutId) {
      return res.json({ layout: null });
    }

    const layout = await SeatingLayout.findById(gig.seatingLayoutId).exec();
    if (!layout) {
      return res.json({ layout: null });
    }

    return res.json({
      layout: {
        id: layout.id,
        name: layout.name,
        locationId: String(layout.locationId),
        description: layout.description,
        totalCapacity: layout.totalCapacity,
        sections: layout.sections,
        seats: layout.seats,
        floors: (layout as any).floors,
        stagePosition: layout.stagePosition,
      },
    });
  } catch (err) {
    console.error("GET /seating/gigs/:gigId/layout error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Get available seats for a gig (with sold seats marked)
 * GET /api/seating/gigs/:gigId/available-seats
 */
router.get("/gigs/:gigId/available-seats", async (req, res: Response) => {
  try {
    const { gigId } = req.params as { gigId: string };

    const gig = await Gig.findById(gigId).exec();
    if (!gig) {
      return res.status(404).json({ message: "Gig not found" });
    }

    if (!gig.seatingLayoutId) {
      return res.status(400).json({
        message: "This event does not have reserved seating",
      });
    }

    const layout = await SeatingLayout.findById(gig.seatingLayoutId).exec();
    if (!layout) {
      return res.status(404).json({ message: "Seating layout not found" });
    }

    // Get all sold seat IDs for this gig
    const tickets = await Ticket.find({
      gigId: gig._id,
      status: { $in: ["valid", "used"] },
      seatAssignments: { $exists: true, $ne: [] },
    })
      .select("seatAssignments")
      .exec();

    const soldSeatIds = new Set<string>();
    for (const ticket of tickets) {
      if (ticket.seatAssignments) {
        for (const seat of ticket.seatAssignments) {
          soldSeatIds.add(seat.seatId);
        }
      }
    }

    // Get tiers
    const tiers = await TicketTier.find({ gigId: gig._id })
      .sort({ sortOrder: 1 })
      .exec();

    return res.json({
      layout: {
        id: layout.id,
        name: layout.name,
        locationId: String(layout.locationId),
        description: layout.description,
        totalCapacity: layout.totalCapacity,
        sections: layout.sections,
        seats: layout.seats.map((s) => ({
          ...s,
          tierId: s.tierId ? String(s.tierId) : undefined,
          isSold: soldSeatIds.has(s.seatId),
        })),
        floors: (layout as any).floors,
        stagePosition: layout.stagePosition,
      },
      soldSeatIds: Array.from(soldSeatIds),
      tiers: tiers.map((t) => ({
        id: t.id,
        gigId: String(t.gigId),
        name: t.name,
        description: t.description,
        tierType: t.tierType,
        price: t.price,
        capacity: t.capacity,
        sold: t.sold,
        remaining: Math.max(0, t.capacity - t.sold),
        available: t.available,
        sortOrder: t.sortOrder,
        color: t.color,
      })),
    });
  } catch (err) {
    console.error("GET /seating/gigs/:gigId/available-seats error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Create/update seating layout for a gig (host only)
 * POST /api/seating/gigs/:gigId/layout
 */
router.post(
  "/gigs/:gigId/layout",
  requireRole("customer"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { gigId } = req.params as { gigId: string };
      const { name, sections, stagePosition, useSimpleLayout } = req.body as {
        name: string;
        sections?: Array<{
          name: string;
          rows: number;
          seatsPerRow: number;
          tierId?: string;
          color?: string;
        }>;
        stagePosition?: "top" | "bottom" | "left" | "right";
        useSimpleLayout?: boolean;
      };

      const gig = await Gig.findById(gigId).exec();
      if (!gig) {
        return res.status(404).json({ message: "Gig not found" });
      }

      if (String(gig.createdByUserId) !== req.authUser!.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      if (!gig.locationId) {
        return res.status(400).json({
          message: "Gig must have a location to create seating layout",
        });
      }

      let layout;

      if (useSimpleLayout && sections) {
        // Generate a simple layout from sections definition
        const sectionParams = sections.map((s) => ({
          name: s.name,
          rows: s.rows,
          seatsPerRow: s.seatsPerRow,
          tierId: s.tierId ? new mongoose.Types.ObjectId(s.tierId) : undefined,
          color: s.color,
        }));

        layout = (SeatingLayout as any).generateSimpleLayout({
          name: name || `${gig.title} Seating`,
          locationId: gig.locationId,
          createdByUserId: new mongoose.Types.ObjectId(req.authUser!.id),
          sections: sectionParams,
        });

        if (stagePosition) {
          layout.stagePosition = stagePosition;
        }

        await layout.save();
      } else {
        // Create empty layout for manual configuration
        layout = await SeatingLayout.create({
          name: name || `${gig.title} Seating`,
          locationId: gig.locationId,
          createdByUserId: new mongoose.Types.ObjectId(req.authUser!.id),
          totalCapacity: 0,
          sections: [],
          seats: [],
          stagePosition: stagePosition || "top",
        });
      }

      // Link layout to gig
      gig.seatingLayoutId = layout._id as mongoose.Types.ObjectId;
      gig.seatingType = "reserved";
      await gig.save();

      return res.status(201).json({
        layout: {
          id: layout.id,
          name: layout.name,
          locationId: String(layout.locationId),
          description: layout.description,
          totalCapacity: layout.totalCapacity,
          sections: layout.sections,
          seats: layout.seats,
          floors: (layout as any).floors,
          stagePosition: layout.stagePosition,
        },
      });
    } catch (err) {
      console.error("POST /seating/gigs/:gigId/layout error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

/**
 * Clone a location template layout onto a gig (host only)
 * POST /api/seating/gigs/:gigId/layout/clone
 */
router.post(
  "/gigs/:gigId/layout/clone",
  requireRole("customer"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { gigId } = req.params as { gigId: string };
      const { templateLayoutId } = req.body as { templateLayoutId: string };

      if (!templateLayoutId) {
        return res
          .status(400)
          .json({ message: "templateLayoutId is required" });
      }

      const gig = await Gig.findById(gigId).exec();
      if (!gig) {
        return res.status(404).json({ message: "Gig not found" });
      }

      if (String(gig.createdByUserId) !== req.authUser!.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      if (!gig.locationId) {
        return res.status(400).json({ message: "Gig must have a location" });
      }

      const template = await SeatingLayout.findById(templateLayoutId).exec();
      if (!template) {
        return res.status(404).json({ message: "Template layout not found" });
      }

      if (String(template.createdByUserId) !== req.authUser!.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      if (String(template.locationId) !== String(gig.locationId)) {
        return res.status(400).json({
          message: "Template layout must belong to the gig's location",
        });
      }

      const cloned = await SeatingLayout.create({
        name: template.name,
        locationId: template.locationId,
        createdByUserId: new mongoose.Types.ObjectId(req.authUser!.id),
        description: template.description,
        totalCapacity: template.totalCapacity,
        sections: template.sections,
        seats: template.seats,
        floors: (template as any).floors,
        elements: (template as any).elements,
        backgroundImageUrl: (template as any).backgroundImageUrl,
        stage: (template as any).stage,
        isTemplate: false,
        stagePosition: template.stagePosition || "top",
      });

      gig.seatingLayoutId = cloned._id as mongoose.Types.ObjectId;
      gig.seatingType = "reserved";
      await gig.save();

      return res.status(201).json({
        layout: {
          id: cloned.id,
          name: cloned.name,
          locationId: String(cloned.locationId),
          description: cloned.description,
          totalCapacity: cloned.totalCapacity,
          sections: cloned.sections,
          seats: cloned.seats,
          floors: (cloned as any).floors,
          elements: (cloned as any).elements,
          backgroundImageUrl: (cloned as any).backgroundImageUrl,
          stage: (cloned as any).stage,
          stagePosition: cloned.stagePosition,
        },
      });
    } catch (err) {
      console.error("POST /seating/gigs/:gigId/layout/clone error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

/**
 * Update gig seating configuration (host only)
 * PATCH /api/seating/gigs/:gigId/config
 */
router.patch(
  "/gigs/:gigId/config",
  requireRole("customer"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { gigId } = req.params as { gigId: string };
      const { seatingType, seatCapacity, ticketPrice } = req.body as {
        seatingType?: "general_admission" | "reserved" | "mixed";
        seatCapacity?: number;
        ticketPrice?: number;
      };

      const gig = await Gig.findById(gigId).exec();
      if (!gig) {
        return res.status(404).json({ message: "Gig not found" });
      }

      if (String(gig.createdByUserId) !== req.authUser!.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      if (seatingType !== undefined) {
        gig.seatingType = seatingType;
      }
      if (seatCapacity !== undefined) {
        gig.seatCapacity = seatCapacity;
      }
      if (ticketPrice !== undefined) {
        gig.ticketPrice = ticketPrice;
      }

      await gig.save();

      return res.json({
        gig: {
          id: gig.id,
          seatingType: gig.seatingType,
          seatCapacity: gig.seatCapacity,
          ticketPrice: gig.ticketPrice,
          hasTicketTiers: gig.hasTicketTiers,
          seatingLayoutId: gig.seatingLayoutId
            ? String(gig.seatingLayoutId)
            : null,
        },
      });
    } catch (err) {
      console.error("PATCH /seating/gigs/:gigId/config error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

// ==================== LOCATION CAPACITY ====================

/**
 * Update location seat capacity (host only)
 * PATCH /api/seating/locations/:locationId/capacity
 */
router.patch(
  "/locations/:locationId/capacity",
  requireRole("customer"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { locationId } = req.params as { locationId: string };
      const { seatCapacity } = req.body as { seatCapacity: number };

      if (typeof seatCapacity !== "number" || seatCapacity < 0) {
        return res.status(400).json({
          message: "seatCapacity must be a non-negative number",
        });
      }

      const location = await Location.findById(locationId).exec();
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }

      // Verify ownership or admin
      if (
        location.createdByUserId &&
        String(location.createdByUserId) !== req.authUser!.id
      ) {
        return res.status(403).json({ message: "Forbidden" });
      }

      location.seatCapacity = seatCapacity;
      await location.save();

      return res.json({
        location: {
          id: location.id,
          name: location.name,
          seatCapacity: location.seatCapacity,
        },
      });
    } catch (err) {
      console.error("PATCH /seating/locations/:locationId/capacity error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

/**
 * Get seating layouts for a location
 * GET /api/seating/locations/:locationId/layouts
 */
router.get("/locations/:locationId/layouts", async (req, res: Response) => {
  try {
    const { locationId } = req.params as { locationId: string };

    const layouts = await SeatingLayout.find({
      locationId: new mongoose.Types.ObjectId(locationId),
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();

    return res.json({
      layouts: layouts.map((l) => ({
        id: l.id,
        name: l.name,
        description: l.description,
        totalCapacity: l.totalCapacity,
        isTemplate: l.isTemplate,
        stagePosition: l.stagePosition,
      })),
    });
  } catch (err) {
    console.error("GET /seating/locations/:locationId/layouts error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
