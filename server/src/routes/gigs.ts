import type { Response, Router } from "express";
import express from "express";
import mongoose from "mongoose";
import { requireRole, type AuthenticatedRequest } from "../middleware/auth";
import { Gig } from "../models/Gig";
import { GigApplication } from "../models/GigApplication";
import { Location } from "../models/Location";
import { ArtistRequest } from "../models/ArtistRequest";
import { MusicianProfile } from "../models/MusicianProfile";
import { Ticket } from "../models/Ticket";

const router: Router = express.Router();

router.post(
  "/",
  requireRole("customer"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { title, description, date, time, budget, locationId, location } =
        req.body as {
          title: string;
          description?: string;
          date: string;
          time?: string;
          budget?: number;
          locationId?: string;
          location?: { name: string; address?: string; city?: string };
        };

      if (!title || !date) {
        return res.status(400).json({ message: "title and date are required" });
      }

      let resolvedLocationId: mongoose.Types.ObjectId | undefined;
      if (locationId) {
        resolvedLocationId = new mongoose.Types.ObjectId(locationId);
      } else if (location?.name) {
        const created = await Location.create({
          name: location.name,
          address: location.address,
          city: location.city,
          images: [],
        });
        resolvedLocationId = new mongoose.Types.ObjectId(created.id);
      }

      const createdByUserId = new mongoose.Types.ObjectId(req.authUser!.id);

      const gig = await Gig.create({
        title,
        description,
        date,
        time,
        budget,
        locationId: resolvedLocationId,
        createdByUserId,
        status: "open",
      });

      return res.status(201).json({
        id: gig.id,
        title: gig.title,
        description: gig.description,
        date: gig.date,
        time: gig.time,
        budget: gig.budget,
        status: gig.status,
        locationId: gig.locationId ? String(gig.locationId) : null,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /gigs error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

// Get a single gig by ID (host/admin only for their own gigs)
router.get(
  "/:id",
  requireRole("customer"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const userId = req.authUser!.id;

      const gig = await Gig.findById(id).exec();
      if (!gig) {
        return res.status(404).json({ message: "Gig not found" });
      }

      // Check if user is the creator or admin
      const isOwner = String(gig.createdByUserId) === userId;
      const isAdmin = req.authUser!.roles?.includes("admin") ?? false;

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Get location details
      let location = null;
      if (gig.locationId) {
        const loc = await Location.findById(gig.locationId).exec();
        if (loc) {
          location = {
            id: loc.id,
            name: loc.name,
            address: loc.address,
            city: loc.city,
          };
        }
      }

      // Get ticket stats
      const ticketStats = await Ticket.aggregate([
        {
          $match: {
            gigId: gig._id,
            status: { $in: ["valid", "used"] },
          },
        },
        {
          $group: {
            _id: null,
            ticketsSold: { $sum: "$quantity" },
            ticketRevenue: { $sum: "$totalPaid" },
          },
        },
      ]);

      const stats = ticketStats[0] ?? { ticketsSold: 0, ticketRevenue: 0 };

      return res.json({
        id: gig.id,
        title: gig.title,
        description: gig.description,
        date: gig.date,
        time: gig.time,
        budget: gig.budget,
        status: gig.status,
        gigType: gig.gigType,
        openForTickets: gig.openForTickets,
        ticketPrice: gig.ticketPrice,
        seatingType: gig.seatingType,
        seatCapacity: gig.seatCapacity,
        hasTicketTiers: gig.hasTicketTiers,
        locationId: gig.locationId ? String(gig.locationId) : null,
        location,
        ticketsSold: stats.ticketsSold,
        ticketRevenue: stats.ticketRevenue,
        createdAt: (gig as any).createdAt,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("GET /gigs/:id error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

router.get(
  "/mine",
  requireRole("customer"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = new mongoose.Types.ObjectId(req.authUser!.id);
      const gigs = await Gig.find({ createdByUserId: userId })
        .sort({ createdAt: -1 })
        .limit(200)
        .exec();

      // Get ticket stats for all gigs in a single aggregation
      const gigIds = gigs.map((g) => g._id);
      const ticketStats = await Ticket.aggregate([
        {
          $match: {
            gigId: { $in: gigIds },
            status: { $in: ["valid", "used"] },
          },
        },
        {
          $group: {
            _id: "$gigId",
            ticketsSold: { $sum: "$quantity" },
            ticketRevenue: { $sum: "$totalPaid" },
          },
        },
      ]);

      // Get application counts
      const applicationCounts = await GigApplication.aggregate([
        { $match: { gigId: { $in: gigIds } } },
        { $group: { _id: "$gigId", count: { $sum: 1 } } },
      ]);

      // Create lookup maps
      const ticketStatsMap = new Map(
        ticketStats.map((s) => [String(s._id), s]),
      );
      const applicationCountMap = new Map(
        applicationCounts.map((a) => [String(a._id), a.count]),
      );

      return res.json({
        gigs: gigs.map((g) => {
          const stats = ticketStatsMap.get(String(g._id));
          return {
            id: g.id,
            title: g.title,
            description: g.description,
            date: g.date,
            time: g.time,
            budget: g.budget,
            status: g.status,
            gigType: g.gigType,
            openForTickets: g.openForTickets,
            ticketPrice: g.ticketPrice,
            locationId: g.locationId ? String(g.locationId) : null,
            // Stats
            ticketsSold: stats?.ticketsSold ?? 0,
            ticketRevenue: stats?.ticketRevenue ?? 0,
            applicantCount: applicationCountMap.get(String(g._id)) ?? 0,
          };
        }),
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("GET /gigs/mine error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

router.post(
  "/:id/apply",
  requireRole("musician"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const { message } = req.body as { message?: string };

      const gig = await Gig.findById(id).exec();
      if (!gig) return res.status(404).json({ message: "Gig not found" });
      if (gig.status !== "open") {
        return res.status(400).json({ message: "Gig is not open" });
      }

      const applicantUserId = new mongoose.Types.ObjectId(req.authUser!.id);
      const gigId = new mongoose.Types.ObjectId(gig.id);

      const existing = await GigApplication.findOne({
        gigId,
        applicantUserId,
      }).exec();
      if (existing) {
        return res.status(409).json({
          message: "You have already applied to this gig",
        });
      }

      const application = await GigApplication.create({
        gigId,
        applicantUserId,
        message,
        status: "pending",
      });

      return res.status(201).json({
        id: application.id,
        gigId: String(application.gigId),
        status: application.status,
        message: application.message ?? null,
        createdAt: application.createdAt,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /gigs/:id/apply error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

router.get(
  "/:id/applications",
  requireRole("customer"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const gig = await Gig.findById(id).exec();
      if (!gig) return res.status(404).json({ message: "Gig not found" });

      const requesterId = String(req.authUser!.id);
      if (String(gig.createdByUserId) !== requesterId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const gigId = new mongoose.Types.ObjectId(gig.id);
      const applications = await GigApplication.find({ gigId })
        .sort({ createdAt: -1 })
        .limit(500)
        .exec();

      const applicantIds = applications.map((a) => a.applicantUserId);
      const users = applicantIds.length
        ? await mongoose
            .model("User")
            .find({ _id: { $in: applicantIds } })
            .select({ name: 1, email: 1, roles: 1 })
            .exec()
        : [];
      const userById = new Map(users.map((u: any) => [String(u._id), u]));

      return res.json({
        applications: applications.map((a) => {
          const u = userById.get(String(a.applicantUserId));
          return {
            id: a.id,
            gigId: String(a.gigId),
            status: a.status,
            message: a.message ?? null,
            createdAt: a.createdAt,
            decidedAt: a.decidedAt ?? null,
            applicant: u
              ? {
                  id: String(u._id),
                  name: u.name,
                  email: u.email,
                  roles: u.roles,
                }
              : {
                  id: String(a.applicantUserId),
                  name: "Unknown",
                  email: "",
                  roles: [],
                },
          };
        }),
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("GET /gigs/:id/applications error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

router.post(
  "/:id/applications/:applicationId/decision",
  requireRole("customer"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id, applicationId } = req.params as {
        id: string;
        applicationId: string;
      };
      const { decision } = req.body as { decision: "accept" | "deny" };
      if (decision !== "accept" && decision !== "deny") {
        return res.status(400).json({ message: "Invalid decision" });
      }

      const gig = await Gig.findById(id).exec();
      if (!gig) return res.status(404).json({ message: "Gig not found" });

      const requesterId = String(req.authUser!.id);
      if (String(gig.createdByUserId) !== requesterId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const application = await GigApplication.findById(applicationId).exec();
      if (!application) return res.status(404).json({ message: "Not found" });

      if (String(application.gigId) !== String(gig.id)) {
        return res
          .status(400)
          .json({ message: "Application does not belong to gig" });
      }

      application.status = decision === "accept" ? "accepted" : "denied";
      application.decidedAt = new Date();
      application.decidedByUserId = new mongoose.Types.ObjectId(
        req.authUser!.id,
      );
      await application.save();

      return res.json({
        id: application.id,
        status: application.status,
        decidedAt: application.decidedAt,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        "POST /gigs/:id/applications/:applicationId/decision error",
        err,
      );
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

// Host requests a specific artist for a gig.
// A gig must exist, belong to the host, and have a location before a request can be made.
router.post(
  "/:id/request-artist",
  requireRole("customer"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const { musicianUserId, priceOffered, message } = req.body as {
        musicianUserId?: string;
        priceOffered?: number;
        message?: string;
      };

      if (!musicianUserId) {
        return res.status(400).json({ message: "musicianUserId is required" });
      }

      const gig = await Gig.findById(id).exec();
      if (!gig) return res.status(404).json({ message: "Gig not found" });

      const requesterId = String(req.authUser!.id);
      if (String(gig.createdByUserId) !== requesterId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      if (!gig.locationId) {
        return res.status(400).json({
          message: "Gig must have a location before requesting an artist",
        });
      }

      const musicianProfile = await MusicianProfile.findOne({
        userId: musicianUserId,
      }).exec();

      if (!musicianProfile) {
        return res.status(404).json({ message: "Musician not found" });
      }

      if (!musicianProfile.acceptsDirectRequests) {
        return res.status(400).json({
          message: "This artist is not accepting direct requests",
        });
      }

      let resolvedPrice: number | undefined;
      if (typeof priceOffered === "number") {
        resolvedPrice = Number.isFinite(priceOffered)
          ? priceOffered
          : undefined;
      } else if (
        typeof musicianProfile.defaultHourlyRate === "number" &&
        musicianProfile.defaultHourlyRate > 0
      ) {
        resolvedPrice = musicianProfile.defaultHourlyRate;
      }

      if (!resolvedPrice || resolvedPrice <= 0) {
        return res.status(400).json({
          message: "A positive priceOffered is required to request an artist",
        });
      }

      const gigId = new mongoose.Types.ObjectId(gig.id);
      const musicianUserObjectId = new mongoose.Types.ObjectId(musicianUserId);
      const createdByUserId = new mongoose.Types.ObjectId(requesterId);

      const existing = await ArtistRequest.findOne({
        gigId,
        musicianUserId: musicianUserObjectId,
        status: "pending",
      }).exec();
      if (existing) {
        return res.status(409).json({
          message: "You already have a pending request for this artist",
        });
      }

      const request = await ArtistRequest.create({
        gigId,
        musicianUserId: musicianUserObjectId,
        createdByUserId,
        priceOffered: resolvedPrice,
        message,
        status: "pending",
      });

      return res.status(201).json({
        id: request.id,
        gigId: String(request.gigId),
        musicianUserId: String(request.musicianUserId),
        priceOffered: request.priceOffered,
        status: request.status,
        message: request.message ?? null,
        createdAt: (request as any).createdAt,
        decidedAt: request.decidedAt ?? null,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /gigs/:id/request-artist error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

export default router;
