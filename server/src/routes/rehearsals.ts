import type { Response, Router } from "express";
import express from "express";
import mongoose from "mongoose";
import { requireRole, type AuthenticatedRequest } from "../middleware/auth";
import { Rehearsal } from "../models/Rehearsal";
import { Gig } from "../models/Gig";
import { User } from "../models/User";

const router: Router = express.Router();

function isAdmin(req: AuthenticatedRequest): boolean {
  return (req.authUser?.roles ?? []).includes("admin");
}

/**
 * Create a rehearsal/tryout for a gig.
 * POST /api/rehearsals
 */
router.post(
  "/",
  requireRole("customer"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        gigId,
        date,
        time,
        duration,
        deposit,
        participantMusicianIds,
        notes,
        locationId,
      } = req.body as {
        gigId?: string;
        date?: string;
        time?: string;
        duration?: number;
        deposit?: number;
        participantMusicianIds?: string[];
        notes?: string;
        locationId?: string;
      };

      if (!gigId || !mongoose.isValidObjectId(gigId)) {
        return res.status(400).json({ message: "Invalid gig id" });
      }
      if (!date || typeof date !== "string" || !date.trim()) {
        return res.status(400).json({ message: "Date is required" });
      }
      if (typeof deposit !== "number" || Number.isNaN(deposit) || deposit < 0) {
        return res.status(400).json({ message: "Deposit must be >= 0" });
      }
      if (
        duration !== undefined &&
        (typeof duration !== "number" ||
          Number.isNaN(duration) ||
          duration <= 0)
      ) {
        return res.status(400).json({ message: "Duration must be > 0" });
      }

      const ids = (participantMusicianIds ?? []).filter((id) =>
        mongoose.isValidObjectId(id),
      );
      const uniqueIds = Array.from(new Set(ids));
      if (!uniqueIds.length) {
        return res
          .status(400)
          .json({ message: "Provide at least one musician" });
      }
      if (uniqueIds.length > 25) {
        return res.status(400).json({ message: "Too many musicians (max 25)" });
      }

      const gig = await Gig.findById(gigId).exec();
      if (!gig) return res.status(404).json({ message: "Gig not found" });

      const userId = new mongoose.Types.ObjectId(req.authUser!.id);
      if (!isAdmin(req) && String(gig.createdByUserId) !== String(userId)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const musicianDocs = await User.find({
        _id: { $in: uniqueIds.map((id) => new mongoose.Types.ObjectId(id)) },
      })
        .select({ roles: 1 })
        .limit(50)
        .exec();
      const musicianIdSet = new Set(
        musicianDocs
          .filter((u) => (u.roles ?? []).includes("musician"))
          .map((u) => String(u._id)),
      );
      const filtered = uniqueIds.filter((id) => musicianIdSet.has(id));
      if (!filtered.length) {
        return res
          .status(400)
          .json({ message: "No valid musician accounts provided" });
      }

      const created = await Rehearsal.create({
        gigId: new mongoose.Types.ObjectId(gigId),
        createdByUserId: userId,
        date: date.trim(),
        time: typeof time === "string" && time.trim() ? time.trim() : undefined,
        duration,
        deposit,
        participants: filtered.map((id) => ({
          musicianId: new mongoose.Types.ObjectId(id),
          status: "invited",
        })),
        status: "pending",
        notes:
          typeof notes === "string" && notes.trim() ? notes.trim() : undefined,
        locationId:
          locationId && mongoose.isValidObjectId(locationId)
            ? new mongoose.Types.ObjectId(locationId)
            : undefined,
      });

      return res.status(201).json({
        rehearsal: {
          id: created.id,
          gigId: String(created.gigId),
          date: created.date,
          time: created.time,
          duration: created.duration,
          deposit: created.deposit,
          status: created.status,
          notes: created.notes,
          locationId: created.locationId ? String(created.locationId) : null,
          participants: created.participants.map((p) => ({
            musicianId: String(p.musicianId),
            status: p.status,
            payoutPercentage: p.payoutPercentage,
          })),
        },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /rehearsals error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

/**
 * List rehearsals for a gig (host only).
 * GET /api/rehearsals/gig/:gigId
 */
router.get(
  "/gig/:gigId",
  requireRole("customer"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { gigId } = req.params as { gigId: string };
      if (!mongoose.isValidObjectId(gigId)) {
        return res.status(400).json({ message: "Invalid gig id" });
      }

      const gig = await Gig.findById(gigId).exec();
      if (!gig) return res.status(404).json({ message: "Gig not found" });

      const userId = new mongoose.Types.ObjectId(req.authUser!.id);
      if (!isAdmin(req) && String(gig.createdByUserId) !== String(userId)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const rehearsals = await Rehearsal.find({
        gigId: new mongoose.Types.ObjectId(gigId),
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .exec();

      return res.json({
        rehearsals: rehearsals.map((r) => ({
          id: r.id,
          gigId: String(r.gigId),
          date: r.date,
          time: r.time,
          duration: r.duration,
          deposit: r.deposit,
          status: r.status,
          notes: r.notes,
          locationId: r.locationId ? String(r.locationId) : null,
          participants: r.participants.map((p) => ({
            musicianId: String(p.musicianId),
            status: p.status,
            payoutPercentage: p.payoutPercentage,
          })),
        })),
      });
    } catch (err) {
      console.error("GET /rehearsals/gig/:gigId error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

/**
 * List rehearsals where the current musician is a participant.
 * GET /api/rehearsals/mine
 */
router.get(
  "/mine",
  requireRole("musician"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = new mongoose.Types.ObjectId(req.authUser!.id);

      const rehearsals = await Rehearsal.find({
        "participants.musicianId": userId,
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .exec();

      return res.json({
        rehearsals: rehearsals.map((r) => {
          const me = r.participants.find(
            (p) => String(p.musicianId) === String(userId),
          );
          return {
            id: r.id,
            gigId: String(r.gigId),
            date: r.date,
            time: r.time,
            duration: r.duration,
            deposit: r.deposit,
            status: r.status,
            notes: r.notes,
            locationId: r.locationId ? String(r.locationId) : null,
            myStatus: me?.status ?? "invited",
          };
        }),
      });
    } catch (err) {
      console.error("GET /rehearsals/mine error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

/**
 * Musician responds to an invite.
 * POST /api/rehearsals/:id/respond
 */
router.post(
  "/:id/respond",
  requireRole("musician"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const { response } = req.body as { response?: "accept" | "decline" };

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Invalid rehearsal id" });
      }
      if (response !== "accept" && response !== "decline") {
        return res.status(400).json({ message: "Invalid response" });
      }

      const userId = new mongoose.Types.ObjectId(req.authUser!.id);
      const rehearsal = await Rehearsal.findById(id).exec();
      if (!rehearsal) return res.status(404).json({ message: "Not found" });

      const idx = rehearsal.participants.findIndex(
        (p) => String(p.musicianId) === String(userId),
      );
      if (idx === -1) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const current = rehearsal.participants[idx]!.status;
      if (current === "selected" || current === "rejected") {
        return res
          .status(400)
          .json({ message: "This rehearsal has already been decided" });
      }

      rehearsal.participants[idx]!.status =
        response === "accept" ? "accepted" : "declined";
      await rehearsal.save();

      return res.json({
        rehearsal: {
          id: rehearsal.id,
          myStatus: rehearsal.participants[idx]!.status,
        },
      });
    } catch (err) {
      console.error("POST /rehearsals/:id/respond error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

/**
 * Host selects the winning musician.
 * POST /api/rehearsals/:id/select-winner
 */
router.post(
  "/:id/select-winner",
  requireRole("customer"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const { musicianId, payoutPercentage } = req.body as {
        musicianId?: string;
        payoutPercentage?: number;
      };

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Invalid rehearsal id" });
      }
      if (!musicianId || !mongoose.isValidObjectId(musicianId)) {
        return res.status(400).json({ message: "Invalid musician id" });
      }
      if (
        payoutPercentage !== undefined &&
        (typeof payoutPercentage !== "number" ||
          Number.isNaN(payoutPercentage) ||
          payoutPercentage < 0 ||
          payoutPercentage > 100)
      ) {
        return res
          .status(400)
          .json({ message: "payoutPercentage must be 0-100" });
      }

      const userId = new mongoose.Types.ObjectId(req.authUser!.id);
      const rehearsal = await Rehearsal.findById(id).exec();
      if (!rehearsal) return res.status(404).json({ message: "Not found" });

      if (
        !isAdmin(req) &&
        String(rehearsal.createdByUserId) !== String(userId)
      ) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const winner = String(musicianId);
      const hadWinner = rehearsal.participants.some(
        (p) => p.status === "selected",
      );
      if (hadWinner) {
        return res
          .status(400)
          .json({ message: "Winner already selected for this rehearsal" });
      }

      const hasCandidate = rehearsal.participants.some(
        (p) => String(p.musicianId) === winner,
      );
      if (!hasCandidate) {
        return res
          .status(400)
          .json({ message: "Musician is not a participant" });
      }

      rehearsal.participants = rehearsal.participants.map((p) => {
        const isWinner = String(p.musicianId) === winner;
        if (isWinner) {
          return {
            ...p,
            status: "selected",
            payoutPercentage: payoutPercentage ?? p.payoutPercentage,
          };
        }
        if (p.status === "declined") return p;
        return { ...p, status: "rejected" };
      });
      await rehearsal.save();

      return res.json({
        rehearsal: {
          id: rehearsal.id,
          participants: rehearsal.participants.map((p) => ({
            musicianId: String(p.musicianId),
            status: p.status,
            payoutPercentage: p.payoutPercentage,
          })),
        },
      });
    } catch (err) {
      console.error("POST /rehearsals/:id/select-winner error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

export default router;
