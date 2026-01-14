import type { Response, Router } from "express";
import express from "express";
import mongoose from "mongoose";
import { requireRole, type AuthenticatedRequest } from "../middleware/auth";
import { Gig } from "../models/Gig";
import { GigApplication } from "../models/GigApplication";
import { Location } from "../models/Location";

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
  }
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

      return res.json({
        gigs: gigs.map((g) => ({
          id: g.id,
          title: g.title,
          description: g.description,
          date: g.date,
          time: g.time,
          budget: g.budget,
          status: g.status,
          locationId: g.locationId ? String(g.locationId) : null,
        })),
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("GET /gigs/mine error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
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
  }
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
  }
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
        req.authUser!.id
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
        err
      );
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

export default router;
