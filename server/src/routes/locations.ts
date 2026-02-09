import type { Response, Router } from "express";
import express from "express";
import multer from "multer";
import mongoose from "mongoose";
import { Location } from "../models/Location";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";

const router: Router = express.Router();

// Multer instance for parsing multipart/form-data uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
});

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

// Upload images for a given location (owner only)
router.post(
  "/:id/images",
  requireAuth,
  upload.array("images", 8),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!ensureStageCreator(req, res)) return;

      const { id } = req.params as { id: string };
      if (!id) return res.status(400).json({ message: "Missing location id" });

      const location = await Location.findById(id).exec();
      if (!location) return res.status(404).json({ message: "Not found" });

      // Only owner or admin may upload images
      const userId = new mongoose.Types.ObjectId(req.authUser!.id);
      if (
        location.createdByUserId &&
        String(location.createdByUserId) !== String(userId) &&
        !(req.authUser!.roles ?? []).includes("admin")
      ) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const files = (req.files as Express.Multer.File[]) || [];
      if (!files.length)
        return res.status(400).json({ message: "No files uploaded" });

      const added = files.map((f) => ({
        filename: f.originalname,
        mimeType: f.mimetype,
        data: f.buffer,
      }));
      location.images = [...(location.images || []), ...added];
      await location.save();

      return res
        .status(201)
        .json({
          uploaded: added.length,
          total: (location.images || []).length,
        });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /locations/:id/images error", err);
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
