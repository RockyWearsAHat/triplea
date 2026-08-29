import type { Response, Router } from "express";
import express from "express";
import * as http from "http";
import multer from "multer";
import mongoose from "mongoose";
import {
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from "../middleware/auth";
import { Gig } from "../models/Gig";
import { TicketTier } from "../models/TicketTier";
import { SeatingLayout } from "../models/SeatingLayout";
import { Ticket } from "../models/Ticket";
import { Location } from "../models/Location";

const router: Router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for floor plan images
});

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
          elements: (layout as any).elements,
          backgroundImageUrl: (layout as any).backgroundImageUrl,
          roomBoundary: (layout as any).roomBoundary,
          stage: (layout as any).stage,
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
          type: string;
          floorId?: string;
          orientation?: "vertical" | "horizontal";
          x: number;
          y: number;
          length?: number;
          thickness?: number;
          label?: string;
          tableShape?: "round" | "rect";
          width?: number;
          height?: number;
          seatCount?: number;
          arrowDir?: "up" | "down" | "left" | "right";
          accessibilityNote?: string;
        }>;
        roomBoundary?: { width: number; height: number } | null;
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

      if (updates.roomBoundary !== undefined) {
        (layout as any).roomBoundary =
          updates.roomBoundary === null ? undefined : updates.roomBoundary;
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
          roomBoundary: (layout as any).roomBoundary,
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
        backgroundImageUrl: (layout as any).backgroundImageUrl ?? null,
        aiPolygonZones: ((layout as any).aiSuggestions?.suggestions ?? [])
          .filter(
            (s: Record<string, unknown>) =>
              Array.isArray(s.points) && (s.points as unknown[]).length >= 3,
          )
          .map((s: Record<string, unknown>) => ({
            type: s.type ?? "seating_zone",
            label: s.label ?? "Section",
            points: s.points as [number, number][],
          })),
      },
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

/**
 * Upload a background image for a layout (local file from user's machine)
 * POST /api/seating/layouts/:layoutId/background-image
 */
router.post(
  "/layouts/:layoutId/background-image",
  requireRole("customer"),
  upload.single("image"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { layoutId } = req.params as { layoutId: string };
      const file = req.file as Express.Multer.File | undefined;
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const layout = await SeatingLayout.findById(layoutId).exec();
      if (!layout) return res.status(404).json({ message: "Layout not found" });

      // Only owner or admin may update
      const userId = req.authUser!.id;
      if (
        String(layout.createdByUserId) !== String(userId) &&
        !(req.authUser!.roles ?? []).includes("admin")
      ) {
        return res.status(403).json({ message: "Forbidden" });
      }

      layout.backgroundImageBlob = {
        filename: file.originalname,
        mimeType: file.mimetype,
        data: file.buffer,
      };
      const imageUrl = `/api/public/seating/layouts/${layoutId}/background-image`;
      layout.backgroundImageUrl = imageUrl;
      await layout.save();

      return res.status(200).json({ imageUrl });
    } catch (err) {
      console.error(
        "POST /seating/layouts/:layoutId/background-image error",
        err,
      );
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

// POST /layouts/:layoutId/generate-from-ai
// One-click: reads stored AI suggestion polygons → generates ISeat[] with posX/posY
router.post(
  "/layouts/:layoutId/generate-from-ai",
  requireAuth,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { layoutId } = req.params as { layoutId: string };
      const { clearExisting = false } = req.body as { clearExisting?: boolean };

      const layout = await SeatingLayout.findById(layoutId);
      if (!layout) return res.status(404).json({ error: "Layout not found" });

      const suggestions: Array<Record<string, unknown>> =
        (layout as any).aiSuggestions?.suggestions ?? [];
      const seatingZones = suggestions.filter(
        (s) =>
          s.type === "seating_zone" &&
          Array.isArray(s.points) &&
          (s.points as unknown[]).length >= 3,
      );

      if (seatingZones.length === 0) {
        return res.status(400).json({
          error: "No polygon seating zones found. Run AI analysis first.",
        });
      }

      const aiMeta = (layout as any).aiSuggestions ?? {};
      const roomBoundary = (layout as any).roomBoundary ?? null;
      const estimatedVenueFeet = {
        width: aiMeta.estimatedVenueWidthFeet,
        height: aiMeta.estimatedVenueHeightFeet,
      };
      const referenceSeat = aiMeta.referenceSeat;
      const GRID = 24; // px per foot

      if (
        !roomBoundary?.width &&
        !roomBoundary?.height &&
        !estimatedVenueFeet.width &&
        !estimatedVenueFeet.height
      ) {
        return res.status(400).json({
          error:
            "Seat generation needs either layout roomBoundary dimensions or AI-detected labeled venue lengths.",
        });
      }

      const { polygonToSeats } = await import("../lib/polygonToSeats.js");

      let newSeats: ReturnType<typeof polygonToSeats> = [];
      let offset = 0;

      for (const zone of seatingZones) {
        const generated = polygonToSeats({
          points: zone.points as [number, number][],
          sectionName: (zone.label as string) ?? "Section",
          roomBoundaryFeet: roomBoundary ?? undefined,
          estimatedVenueFeet,
          referenceSeat,
          gridSize: GRID,
          estimatedSeats:
            typeof zone.estimatedSeats === "number"
              ? zone.estimatedSeats
              : null,
          isAccessible:
            typeof zone.isAccessible === "boolean" ? zone.isAccessible : false,
          seatNumberOffset: offset,
        });
        newSeats = newSeats.concat(generated);
        offset += generated.length;
      }

      if (clearExisting) {
        (layout as any).seats = newSeats;
      } else {
        (layout as any).seats = [...((layout as any).seats ?? []), ...newSeats];
      }

      await (layout as any).save();

      res.json({
        seatsGenerated: newSeats.length,
        totalSeats: (layout as any).seats.length,
      });
    } catch (err) {
      console.error("[generate-from-ai]", err);
      res
        .status(500)
        .json({ error: "Failed to generate seats from AI polygons" });
    }
  },
);

/**
 * Analyze background image with Qwen VL via Ollama (server-side only)
 * POST /api/seating/layouts/:layoutId/analyze-image
 */
router.post(
  "/layouts/:layoutId/analyze-image",
  requireRole("customer"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { layoutId } = req.params as { layoutId: string };

      const layout = await SeatingLayout.findById(layoutId).exec();
      if (!layout) return res.status(404).json({ message: "Layout not found" });

      // Auth check
      const userId = req.authUser!.id;
      const isAdmin = (req.authUser!.roles ?? []).includes("admin");
      if (String(layout.createdByUserId) !== String(userId) && !isAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const blob = (layout as any).backgroundImageBlob as
        | { filename: string; mimeType: string; data: Buffer }
        | undefined;

      if (!blob?.data) {
        return res.status(400).json({
          message:
            "No background image stored on this layout. Upload an image first.",
        });
      }

      // ── Downscale to ≤ 800 px before sending to Ollama ─────────────────
      // Full-resolution venue images can be 4–12 MB of base64 after encoding.
      // At that size, Qwen's context window is dominated by raw pixel tokens,
      // generation takes 5–10 min, and spatial accuracy degrades heavily.
      // Resizing to 800 px keeps enough structural detail for floor-plan
      // analysis while cutting base64 payload to ~100 KB (50–100× smaller).
      let imageBuffer = blob.data;
      try {
        const sharpLib = (await import("sharp")).default;
        imageBuffer = await sharpLib(blob.data)
          .resize({
            width: 800,
            height: 800,
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 85 })
          .toBuffer();
        const originalKB = Math.round(blob.data.length / 1024);
        const resizedKB = Math.round(imageBuffer.length / 1024);
        console.log(
          `[analyze-image] Resized image: ${originalKB} KB → ${resizedKB} KB`,
        );
      } catch (sharpErr) {
        // sharp unavailable or unsupported format — send original, warn only
        console.warn(
          "[analyze-image] sharp resize failed, using original image:",
          sharpErr,
        );
      }
      const base64Image = imageBuffer.toString("base64");

      // Polygon-first prompt (matches venue_ai_generate.mjs v19 — proven superior to bbox format)
      const OLLAMA_PROMPT = [
        "You are a professional venue floor-plan analyzer.",
        "Study the image carefully and return ONLY a raw JSON object with this exact shape:",
        "{",
        '  "elements": [',
        "    {",
        '      "type": "seating_zone"|"stage"|"aisle"|"entrance"|"other",',
        '      "label": "<short name>",',
        '      "points": [[x0,y0],[x1,y1],...],',
        '      "estimatedSeats": <integer or null>,',
        '      "isAccessible": <bool or null>,',
        '      "rotationDeg": <degrees or 0>,',
        '      "notes": "<optional>"',
        "    }",
        "  ],",
        '  "stagePosition": "top"|"bottom"|"left"|"right"|null,',
        '  "capacityEstimate": <integer or null>,',
        '  "observations": "<one sentence>"',
        "}",
        "",
        "RULES:",
        "- points[] are [x, y] pairs as 0-1 FRACTIONS of image width/height (not pixels, not percentages).",
        "- Trace each distinct zone with a tight polygon (4-8 vertices is fine; irregular shapes welcome).",
        "- Include ALL seating zones visible. Label each with a short audience-friendly name (e.g. 'Floor', 'Balcony', 'VIP', 'Left Wing').",
        "- Do NOT include markdown, code fences, or any text outside the JSON object.",
      ].join("\n");
      let ollamaResponse: { response: string };
      try {
        // Use Node.js http.request (no default timeout) instead of global fetch()
        // which uses undici with a 300-s bodyTimeout that kills long VLM calls.
        // Our only timeout is the explicit req.setTimeout(720_000) below.
        ollamaResponse = await new Promise<{ response: string }>(
          (resolve, reject) => {
            const reqBody = JSON.stringify({
              model: "qwen2.5vl:32b",
              prompt: OLLAMA_PROMPT,
              images: [base64Image],
              stream: false,
              keep_alive: "5m",
              options: { num_ctx: 16384, num_predict: 4000, temperature: 0.1 },
            });

            const req = http.request(
              {
                hostname: "127.0.0.1",
                port: 11434,
                path: "/api/generate",
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Content-Length": Buffer.byteLength(reqBody),
                },
              },
              (ollamaRes) => {
                const chunks: Buffer[] = [];
                ollamaRes.on("data", (chunk: Buffer) => chunks.push(chunk));
                ollamaRes.on("end", () => {
                  const body = Buffer.concat(chunks).toString("utf-8");
                  if (ollamaRes.statusCode && ollamaRes.statusCode >= 400) {
                    reject(
                      new Error(
                        `Ollama error ${ollamaRes.statusCode}: ${body.slice(0, 500)}`,
                      ),
                    );
                    return;
                  }
                  try {
                    const parsed = JSON.parse(body) as {
                      response?: string;
                      message?: { content?: string };
                    };
                    const text =
                      typeof parsed.response === "string"
                        ? parsed.response
                        : (parsed.message?.content ?? "");
                    if (!text) {
                      reject(
                        new Error(
                          `Ollama: empty response. Body: ${body.slice(0, 300)}`,
                        ),
                      );
                      return;
                    }
                    resolve({ response: text });
                  } catch {
                    reject(
                      new Error(
                        `Ollama: JSON parse failed. Body: ${body.slice(0, 300)}`,
                      ),
                    );
                  }
                });
                ollamaRes.on("error", reject);
              },
            );

            // 12-minute hard cap (generous for model load + generation)
            req.setTimeout(720_000, () => req.destroy(new Error("timeout")));
            req.on("error", reject);
            req.write(reqBody);
            req.end();
          },
        );
      } catch (fetchErr: unknown) {
        console.error("Ollama request error:", fetchErr);

        // Produce a helpful message depending on failure mode
        let userMsg = "Could not reach Ollama.";
        if (fetchErr instanceof Error) {
          const msg = fetchErr.message.toLowerCase();
          const cause = String(
            (fetchErr as Error & { cause?: unknown }).cause ?? "",
          );
          if (
            msg.includes("econnrefused") ||
            cause.includes("econnrefused") ||
            msg.includes("socket hang up")
          ) {
            userMsg =
              "Ollama is not running. Start it with `ollama serve` and make sure the qwen2.5vl:32b model is available.";
          } else if (
            fetchErr.name === "AbortError" ||
            msg.includes("aborted") ||
            msg.includes("abort")
          ) {
            userMsg =
              "Ollama took too long to respond (>12 min). The model may still be loading — try again in a moment.";
          } else {
            userMsg = `Could not reach Ollama: ${fetchErr.message}`;
          }
        }

        return res.status(502).json({ message: userMsg });
      }

      // Parse the model's JSON response
      let parsed: {
        description?: string;
        stagePosition?: "top" | "bottom" | "left" | "right";
        capacityEstimate?: number;
        estimatedVenueWidthFeet?: number;
        estimatedVenueHeightFeet?: number;
        referenceSeat?: {
          widthFeet?: number;
          depthFeet?: number;
          rowPitchFeet?: number;
        };
        /** v19 polygon-first format */
        elements?: Array<Record<string, unknown>>;
        /** legacy bbox format */
        suggestions?: Array<{
          type: string;
          label: string;
          xPct: number;
          yPct: number;
          widthPct?: number;
          heightPct?: number;
          estimatedSeats?: number;
          rotationDeg?: number;
          isAccessible?: boolean;
          notes?: string;
        }>;
      };

      try {
        const rawText =
          typeof ollamaResponse.response === "string"
            ? ollamaResponse.response.trim()
            : JSON.stringify(ollamaResponse.response);

        // Strip markdown code fences if model ignored "no markdown" instruction
        const cleaned = rawText
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```\s*$/, "")
          .trim();

        parsed = JSON.parse(cleaned) as typeof parsed;
      } catch (parseErr) {
        console.error(
          "Qwen VL response parse error:",
          parseErr,
          ollamaResponse,
        );
        return res.status(422).json({
          message: "AI returned unparseable response",
          raw: ollamaResponse.response?.slice(0, 500),
        });
      }

      // --- Normalise: accept elements[] (polygon-first v19) OR legacy suggestions[] ---
      type RawEl = Record<string, unknown>;
      const rawElements: RawEl[] = Array.isArray(parsed.elements)
        ? (parsed.elements as RawEl[])
        : [];
      const rawLegacy: RawEl[] = Array.isArray(parsed.suggestions)
        ? (parsed.suggestions as RawEl[])
        : [];

      // Convert v19 element (points in 0-1 fraction) to normalised suggestion
      const fromElements = rawElements.map((el) => {
        const pts = Array.isArray(el.points)
          ? (el.points as [number, number][]).filter(
              (p) => Array.isArray(p) && p.length === 2,
            )
          : [];
        // Derive bbox from polygon bounding box for backward compat
        const xs = pts.map(([x]) => x);
        const ys = pts.map(([, y]) => y);
        const xMinF = xs.length ? Math.min(...xs) : 0;
        const xMaxF = xs.length ? Math.max(...xs) : 1;
        const yMinF = ys.length ? Math.min(...ys) : 0;
        const yMaxF = ys.length ? Math.max(...ys) : 1;
        return {
          type: (el.type as string) ?? "seating_zone",
          label: (el.label as string) ?? "Section",
          xPct: Math.round(xMinF * 100),
          yPct: Math.round(yMinF * 100),
          widthPct: Math.round((xMaxF - xMinF) * 100),
          heightPct: Math.round((yMaxF - yMinF) * 100),
          estimatedSeats:
            typeof el.estimatedSeats === "number" ? el.estimatedSeats : null,
          rotationDeg: typeof el.rotationDeg === "number" ? el.rotationDeg : 0,
          isAccessible:
            typeof el.isAccessible === "boolean" ? el.isAccessible : false,
          notes: typeof el.notes === "string" ? el.notes : "",
          // polygon vertices scaled to 0-100 for storage
          points: pts.map(
            ([x, y]) =>
              [Math.round(x * 100), Math.round(y * 100)] as [number, number],
          ),
        };
      });

      const rawSuggestions = (
        fromElements.length > 0 ? fromElements : rawLegacy
      ) as Array<{
        type: string;
        label: string;
        xPct: number;
        yPct: number;
        widthPct?: number;
        heightPct?: number;
        estimatedSeats?: number | null;
        rotationDeg?: number;
        isAccessible?: boolean;
        notes?: string;
        points?: [number, number][];
      }>;

      // Validate and sanitize suggestions
      const VALID_TYPES = new Set([
        "stage",
        "aisle",
        "table",
        "railing",
        "stairs",
        "dance_floor",
        "entrance",
        "seating_zone",
      ]);
      const sanitizedSuggestions = rawSuggestions.filter(
        (s) =>
          VALID_TYPES.has(s.type) &&
          typeof s.xPct === "number" &&
          typeof s.yPct === "number",
      );

      // Auto-normalize: if the model returned 0-1 fractions instead of 0-100 integers,
      // scale everything up. Heuristic: if the max xPct/yPct across all suggestions <= 1.0
      // (and we have at least one suggestion), multiply all pct fields by 100.
      const maxCoord = sanitizedSuggestions.reduce(
        (m: number, s: (typeof sanitizedSuggestions)[0]) =>
          Math.max(m, s.xPct, s.yPct, s.widthPct ?? 0, s.heightPct ?? 0),
        0,
      );
      const pctScale =
        maxCoord <= 1.0 && sanitizedSuggestions.length > 0 ? 100 : 1;

      const mappedSuggestions = sanitizedSuggestions.map((s) => ({
        type: s.type as
          | "stage"
          | "aisle"
          | "table"
          | "railing"
          | "stairs"
          | "dance_floor"
          | "entrance"
          | "seating_zone",
        label: String(s.label || s.type),
        xPct: Math.max(0, Math.min(100, s.xPct * pctScale)),
        yPct: Math.max(0, Math.min(100, s.yPct * pctScale)),
        widthPct:
          typeof s.widthPct === "number"
            ? Math.max(0, Math.min(100, s.widthPct * pctScale))
            : undefined,
        heightPct:
          typeof s.heightPct === "number"
            ? Math.max(0, Math.min(100, s.heightPct * pctScale))
            : undefined,
        estimatedSeats:
          typeof s.estimatedSeats === "number" && s.estimatedSeats > 0
            ? s.estimatedSeats
            : undefined,
        rotationDeg:
          typeof s.rotationDeg === "number"
            ? Math.round(s.rotationDeg)
            : undefined,
        isAccessible: s.isAccessible === true ? true : undefined,
        notes: s.notes ? String(s.notes) : undefined,
        points: s.points && s.points.length > 0 ? s.points : undefined,
      }));
      // (mappedSuggestions is typed; used below in the aiSuggestions object)

      // Extract and validate real-world measurement fields
      const estimatedVenueWidthFeet =
        typeof parsed.estimatedVenueWidthFeet === "number" &&
        parsed.estimatedVenueWidthFeet > 0
          ? parsed.estimatedVenueWidthFeet
          : undefined;
      const estimatedVenueHeightFeet =
        typeof parsed.estimatedVenueHeightFeet === "number" &&
        parsed.estimatedVenueHeightFeet > 0
          ? parsed.estimatedVenueHeightFeet
          : undefined;
      const refSeat = parsed.referenceSeat;
      const referenceSeat =
        refSeat &&
        typeof refSeat.widthFeet === "number" &&
        refSeat.widthFeet > 0
          ? {
              widthFeet: refSeat.widthFeet,
              depthFeet:
                typeof refSeat.depthFeet === "number" && refSeat.depthFeet > 0
                  ? refSeat.depthFeet
                  : refSeat.widthFeet,
              rowPitchFeet:
                typeof refSeat.rowPitchFeet === "number" &&
                refSeat.rowPitchFeet > 0
                  ? refSeat.rowPitchFeet
                  : refSeat.widthFeet * 1.65,
            }
          : undefined;

      const aiSuggestions = {
        analyzedAt: new Date(),
        model: "qwen2.5vl:32b",
        suggestions: mappedSuggestions,
        description: parsed.description
          ? String(parsed.description)
          : undefined,
        stagePosition: ["top", "bottom", "left", "right"].includes(
          parsed.stagePosition ?? "",
        )
          ? (parsed.stagePosition as "top" | "bottom" | "left" | "right")
          : undefined,
        capacityEstimate:
          typeof parsed.capacityEstimate === "number" &&
          parsed.capacityEstimate > 0
            ? parsed.capacityEstimate
            : undefined,
        estimatedVenueWidthFeet,
        estimatedVenueHeightFeet,
        referenceSeat,
      };

      // Persist to layout
      (layout as any).aiSuggestions = aiSuggestions;
      await layout.save();

      return res.json({ aiSuggestions });
    } catch (err) {
      console.error("POST /seating/layouts/:layoutId/analyze-image error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

export default router;
