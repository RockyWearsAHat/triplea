import type { Response, Router } from "express";
import express from "express";
import mongoose from "mongoose";
import { Location } from "../models/Location";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";

const router: Router = express.Router();

// Helper to ensure only appropriate roles can create stage/location listings.
function ensureStageCreator(req: AuthenticatedRequest, res: Response): boolean {
  const user = req.authUser;
  if (!user) {
    res.status(401).json({ message: "Not authenticated" });
    return false;
  }

  const roles = user.roles ?? [];
  const allowed = roles.includes("customer") || roles.includes("admin");
  if (!allowed) {
    res.status(403).json({ message: "Forbidden" });
    return false;
  }
  return true;
}

// Create a new stage/location listing owned by the current host.
router.post(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!ensureStageCreator(req, res)) return;

      const { name, address, city } = req.body as {
        name?: string;
        address?: string;
        city?: string;
      };

      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "Name is required" });
      }

      const createdByUserId = new mongoose.Types.ObjectId(req.authUser!.id);

      const location = await Location.create({
        name: name.trim(),
        address: address?.trim() || undefined,
        city: city?.trim() || undefined,
        createdByUserId,
        images: [],
      });

      return res.status(201).json({
        id: location.id,
        name: location.name,
        address: location.address,
        city: location.city,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /locations error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

// List all stage/location listings created by the current host.
router.get(
  "/mine",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = new mongoose.Types.ObjectId(req.authUser!.id);
      const locations = await Location.find({ createdByUserId: userId })
        .sort({ createdAt: -1 })
        .limit(200)
        .exec();

      return res.json({
        locations: locations.map((l) => ({
          id: l.id,
          name: l.name,
          address: l.address,
          city: l.city,
          imageCount: (l.images ?? []).length,
          imageUrl: (l.images ?? []).length
            ? `/api/public/locations/${l.id}/images/0`
            : undefined,
        })),
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("GET /locations/mine error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

export default router;
