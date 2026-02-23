import type { Response, Router } from "express";
import express from "express";
import mongoose from "mongoose";
import { MusicianProfile, type ColorRating } from "../models/MusicianProfile";
import { requireRole, type AuthenticatedRequest } from "../middleware/auth";

const router: Router = express.Router();

const COLOR_RATINGS: ReadonlySet<ColorRating> = new Set([
  "gold",
  "light-gold",
  "blue",
  "light-blue",
  "purple",
  "light-purple",
]);

function isColorRating(value: unknown): value is ColorRating {
  return typeof value === "string" && (COLOR_RATINGS as Set<string>).has(value);
}

function serializeMusicianProfile(doc: any) {
  return {
    id: String(doc.id),
    userId: String(doc.userId ?? ""),
    instruments: doc.instruments ?? [],
    genres: doc.genres ?? [],
    bio: doc.bio ?? undefined,
    averageRating: doc.averageRating ?? 0,
    reviewCount: doc.reviewCount ?? 0,
    colorRating: doc.colorRating ?? undefined,
    learnSpeed:
      typeof doc.learnSpeed === "number" && doc.learnSpeed > 0
        ? doc.learnSpeed
        : undefined,
    skillLevel:
      typeof doc.skillLevel === "number" && doc.skillLevel > 0
        ? doc.skillLevel
        : undefined,
    defaultHourlyRate:
      typeof doc.defaultHourlyRate === "number" && doc.defaultHourlyRate > 0
        ? doc.defaultHourlyRate
        : undefined,
    acceptsDirectRequests: Boolean(doc.acceptsDirectRequests),
  };
}

async function getOrCreateProfileForUser(userId: string) {
  const existing = await MusicianProfile.findOne({ userId }).exec();
  if (existing) return existing;

  const created = await MusicianProfile.create({
    userId,
    instruments: [],
    genres: [],
    bio: "",
    // New profiles start with neutral rating; updated by future review system.
    averageRating: 5.0,
    reviewCount: 0,
    colorRating: "light-blue",
    learnSpeed: 14,
    skillLevel: 5,
    defaultHourlyRate: null,
    acceptsDirectRequests: false,
  });

  return created;
}

// Get the authenticated musician's profile and marketplace settings.
router.get(
  "/me",
  requireRole("musician"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = String(req.authUser!.id);
      const profile = await getOrCreateProfileForUser(userId);
      return res.json({ musician: serializeMusicianProfile(profile) });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("GET /musicians/me error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

// Update basic profile fields and direct request settings.
router.patch(
  "/me",
  requireRole("musician"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = String(req.authUser!.id);
      const profile = await getOrCreateProfileForUser(userId);

      const {
        instruments,
        genres,
        bio,
        colorRating,
        learnSpeed,
        skillLevel,
        defaultHourlyRate,
        acceptsDirectRequests,
      } = req.body as {
        instruments?: string[];
        genres?: string[];
        bio?: string;
        colorRating?: string;
        learnSpeed?: number;
        skillLevel?: number;
        defaultHourlyRate?: number | null;
        acceptsDirectRequests?: boolean;
      };

      if (Array.isArray(instruments)) {
        profile.instruments = instruments.map((s) => String(s));
      }
      if (Array.isArray(genres)) {
        profile.genres = genres.map((s) => String(s));
      }
      if (typeof bio === "string") {
        profile.bio = bio;
      }
      if (typeof colorRating !== "undefined") {
        if (!isColorRating(colorRating)) {
          return res.status(400).json({ message: "Invalid colorRating" });
        }
        profile.colorRating = colorRating;
      }
      if (typeof learnSpeed === "number") {
        profile.learnSpeed =
          Number.isFinite(learnSpeed) && learnSpeed > 0 ? learnSpeed : 14;
      }
      if (typeof skillLevel === "number") {
        profile.skillLevel =
          Number.isFinite(skillLevel) && skillLevel > 0 ? skillLevel : 5;
      }
      if (typeof defaultHourlyRate === "number") {
        profile.defaultHourlyRate =
          Number.isFinite(defaultHourlyRate) && defaultHourlyRate > 0
            ? defaultHourlyRate
            : null;
      }
      if (typeof acceptsDirectRequests === "boolean") {
        profile.acceptsDirectRequests = acceptsDirectRequests;
      }

      await profile.save();

      return res.json({ musician: serializeMusicianProfile(profile) });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("PATCH /musicians/me error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

export default router;
