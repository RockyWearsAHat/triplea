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
            defaultHourlyRate: m.defaultHourlyRate ?? undefined,
            acceptsDirectRequests: m.acceptsDirectRequests ?? false,
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
        defaultHourlyRate: musician.defaultHourlyRate ?? undefined,
        acceptsDirectRequests: musician.acceptsDirectRequests ?? false,
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
  },
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
  },
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

// Concerts endpoints for marketplace (with optional distance calc)
// Only shows public concerts (not musician-wanted job postings)
router.get("/concerts", async (req: Request, res: Response) => {
  try {
    const lat = toNumber(req.query.lat);
    const lng = toNumber(req.query.lng);
    const radiusMiles = toNumber(req.query.radiusMiles);

    const gigs = await Gig.find({ status: "open", gigType: "public-concert" })
      .sort({ date: 1, time: 1 }) // Sort by date ascending (soonest first)
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

    function haversineMiles(
      aLat: number,
      aLng: number,
      bLat: number,
      bLng: number,
    ) {
      const toRad = (v: number) => (v * Math.PI) / 180;
      const R = 3958.8; // miles
      const dLat = toRad(bLat - aLat);
      const dLon = toRad(bLng - aLng);
      const al =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(aLat)) *
          Math.cos(toRad(bLat)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(al), Math.sqrt(1 - al));
      return R * c;
    }

    const results = gigs
      .map((g) => {
        const loc = g.locationId
          ? locationById.get(String(g.locationId))
          : undefined;
        let distanceMiles: number | undefined = undefined;
        if (
          lat !== undefined &&
          lng !== undefined &&
          loc &&
          (loc as any).coordinates
        ) {
          const c = (loc as any).coordinates;
          if (typeof c.lat === "number" && typeof c.lng === "number") {
            distanceMiles = haversineMiles(lat, lng, c.lat, c.lng);
          }
        }

        return {
          id: g.id,
          title: g.title,
          description: g.description,
          date: g.date,
          time: g.time,
          status: g.status,
          ticketPrice: (g as any).ticketPrice,
          openForTickets: (g as any).openForTickets,
          distanceMiles,
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
      })
      // Filter by radius only if specified, otherwise show all
      .filter((r) =>
        radiusMiles ? (r.distanceMiles ?? Infinity) <= radiusMiles : true,
      )
      // Sort by distance (closest first) when location is available
      .sort((a, b) => {
        // If both have distance, sort by distance
        if (a.distanceMiles !== undefined && b.distanceMiles !== undefined) {
          return a.distanceMiles - b.distanceMiles;
        }
        // Items with distance come first
        if (a.distanceMiles !== undefined) return -1;
        if (b.distanceMiles !== undefined) return 1;
        return 0;
      });

    return res.json({ concerts: results });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/public/concerts error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/concerts/popular", async (_req: Request, res: Response) => {
  try {
    // Popular public concerts only (not musician-wanted postings)
    const gigs = await Gig.find({ status: "open", gigType: "public-concert" })
      .sort({ date: 1 }) // Soonest first
      .limit(12)
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
      concerts: gigs.map((g) => {
        const loc = g.locationId
          ? locationById.get(String(g.locationId))
          : undefined;
        return {
          id: g.id,
          title: g.title,
          description: g.description,
          date: g.date,
          time: g.time,
          ticketPrice: (g as any).ticketPrice,
          openForTickets: (g as any).openForTickets,
          status: g.status,
          location: loc
            ? {
                id: loc.id,
                name: loc.name,
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
    console.error("/public/concerts/popular error", err);
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
        gigType: gig.gigType,
        openForTickets: (gig as any).openForTickets,
        ticketPrice: (gig as any).ticketPrice,
        seatingType: (gig as any).seatingType,
        seatCapacity: (gig as any).seatCapacity,
        hasTicketTiers: (gig as any).hasTicketTiers,
        seatingLayoutId: (gig as any).seatingLayoutId
          ? String((gig as any).seatingLayoutId)
          : undefined,
        location: location
          ? {
              id: location.id,
              name: location.name,
              address: location.address,
              city: location.city,
              coordinates: location.coordinates,
              seatCapacity: (location as any).seatCapacity,
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
