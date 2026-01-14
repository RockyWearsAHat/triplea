import type { Request, Response, Router } from "express";
import express from "express";
import { MusicianProfile } from "../models/MusicianProfile";
import { Instrument } from "../models/Instrument";
import { Location } from "../models/Location";
import { Gig } from "../models/Gig";

const router: Router = express.Router();

function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

// --- Triple A Music (customer/organizer) public discovery ---
router.get("/music/discovery", async (req: Request, res: Response) => {
  try {
    const genre =
      typeof req.query.genre === "string" ? req.query.genre : undefined;
    const maxBudget = toNumber(req.query.maxBudget);

    const query: Record<string, unknown> = {};
    if (genre) {
      query.genres = genre;
    }

    const musicians = await MusicianProfile.find(query)
      .sort({ averageRating: -1 })
      .limit(50)
      .exec();

    const results = musicians
      .map((m) => {
        // Cheap demo estimates; replace with real pricing logic later.
        const base = 250 + Math.round((m.averageRating ?? 4.5) * 120);
        const priceEstimate = maxBudget ? Math.min(maxBudget, base) : base;
        const distanceMinutes = 8 + (m.id.charCodeAt(0) % 18);

        return {
          musician: {
            id: m.id,
            userId: m.userId ?? "",
            instruments: m.instruments,
            genres: m.genres,
            bio: m.bio,
            averageRating: m.averageRating,
            reviewCount: m.reviewCount,
          },
          priceEstimate,
          distanceMinutes,
        };
      })
      .filter((r) => r.priceEstimate > 0);

    return res.json({ results });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/public/music/discovery error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/musicians/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const musician = await MusicianProfile.findById(id).exec();
    if (!musician) {
      return res.status(404).json({ message: "Not found" });
    }

    return res.json({
      musician: {
        id: musician.id,
        userId: musician.userId ?? "",
        instruments: musician.instruments,
        genres: musician.genres,
        bio: musician.bio,
        averageRating: musician.averageRating,
        reviewCount: musician.reviewCount,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/public/musicians/:id error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// --- Triple A Muse (marketplace) public catalog ---
router.get("/marketplace/catalog", async (_req: Request, res: Response) => {
  try {
    const instruments = await Instrument.find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .exec();

    return res.json({
      instruments: instruments.map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        dailyRate: i.dailyRate,
        available: i.available,
        imageCount: (i.images ?? []).length,
        imageUrl: (i.images ?? []).length
          ? `/api/public/instruments/${i.id}/images/0`
          : undefined,
      })),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/public/marketplace/catalog error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/instruments/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const instrument = await Instrument.findById(id).exec();
    if (!instrument) {
      return res.status(404).json({ message: "Not found" });
    }

    return res.json({
      instrument: {
        id: instrument.id,
        name: instrument.name,
        category: instrument.category,
        dailyRate: instrument.dailyRate,
        available: instrument.available,
        imageCount: (instrument.images ?? []).length,
        imageUrl: (instrument.images ?? []).length
          ? `/api/public/instruments/${instrument.id}/images/0`
          : undefined,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/public/instruments/:id error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get(
  "/instruments/:id/images/:index",
  async (req: Request, res: Response) => {
    try {
      const { id, index } = req.params as { id: string; index: string };
      const idx = Number(index);
      if (!Number.isFinite(idx) || idx < 0) {
        return res.status(400).json({ message: "Invalid index" });
      }

      const instrument = await Instrument.findById(id).exec();
      if (!instrument) return res.status(404).json({ message: "Not found" });

      const img = (instrument.images ?? [])[idx];
      if (!img) return res.status(404).json({ message: "Not found" });

      res.setHeader("Content-Type", img.mimeType);
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.status(200).send(img.data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("/public/instruments/:id/images/:index error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.get("/locations", async (_req: Request, res: Response) => {
  try {
    const locations = await Location.find({})
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
    console.error("/public/locations error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/locations/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const location = await Location.findById(id).exec();
    if (!location) return res.status(404).json({ message: "Not found" });

    return res.json({
      location: {
        id: location.id,
        name: location.name,
        address: location.address,
        city: location.city,
        imageCount: (location.images ?? []).length,
        imageUrl: (location.images ?? []).length
          ? `/api/public/locations/${location.id}/images/0`
          : undefined,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/public/locations/:id error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get(
  "/locations/:id/images/:index",
  async (req: Request, res: Response) => {
    try {
      const { id, index } = req.params as { id: string; index: string };
      const idx = Number(index);
      if (!Number.isFinite(idx) || idx < 0) {
        return res.status(400).json({ message: "Invalid index" });
      }

      const location = await Location.findById(id).exec();
      if (!location) return res.status(404).json({ message: "Not found" });

      const img = (location.images ?? [])[idx];
      if (!img) return res.status(404).json({ message: "Not found" });

      res.setHeader("Content-Type", img.mimeType);
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.status(200).send(img.data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("/public/locations/:id/images/:index error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.get("/gigs", async (_req: Request, res: Response) => {
  try {
    const gigs = await Gig.find({ status: "open" })
      .sort({ createdAt: -1 })
      .limit(200)
      .exec();

    const locationIds = gigs
      .map((g) => g.locationId)
      .filter(Boolean)
      .map((id) => String(id));

    const locations = locationIds.length
      ? await Location.find({ _id: { $in: locationIds } }).exec()
      : [];
    const locationById = new Map(locations.map((l) => [String(l.id), l]));

    return res.json({
      gigs: gigs.map((g) => {
        const loc = g.locationId
          ? locationById.get(String(g.locationId))
          : undefined;
        return {
          id: g.id,
          title: g.title,
          description: g.description,
          date: g.date,
          time: g.time,
          budget: g.budget,
          status: g.status,
          location: loc
            ? {
                id: loc.id,
                name: loc.name,
                address: loc.address,
                city: loc.city,
                imageUrl: (loc.images ?? []).length
                  ? `/api/public/locations/${loc.id}/images/0`
                  : undefined,
              }
            : null,
        };
      }),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/public/gigs error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/gigs/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const gig = await Gig.findById(id).exec();
    if (!gig) return res.status(404).json({ message: "Not found" });

    const location = gig.locationId
      ? await Location.findById(gig.locationId).exec()
      : null;

    return res.json({
      gig: {
        id: gig.id,
        title: gig.title,
        description: gig.description,
        date: gig.date,
        time: gig.time,
        budget: gig.budget,
        status: gig.status,
        location: location
          ? {
              id: location.id,
              name: location.name,
              address: location.address,
              city: location.city,
              imageUrl: (location.images ?? []).length
                ? `/api/public/locations/${location.id}/images/0`
                : undefined,
            }
          : null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/public/gigs/:id error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
