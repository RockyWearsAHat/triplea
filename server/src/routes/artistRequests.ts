import type { Response, Router } from "express";
import express from "express";
import mongoose from "mongoose";
import { ArtistRequest } from "../models/ArtistRequest";
import { Gig } from "../models/Gig";
import { requireRole, type AuthenticatedRequest } from "../middleware/auth";

const router: Router = express.Router();

function serializeArtistRequest(doc: any) {
  return {
    id: String(doc.id),
    gigId: String(doc.gigId),
    musicianUserId: String(doc.musicianUserId),
    priceOffered: doc.priceOffered,
    status: doc.status,
    message: doc.message ?? null,
    createdAt: (doc as any).createdAt,
    decidedAt: doc.decidedAt ?? null,
  };
}

// List artist requests where the authenticated musician is the target.
router.get(
  "/mine",
  requireRole("musician"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const musicianUserId = new mongoose.Types.ObjectId(req.authUser!.id);

      const requests = await ArtistRequest.find({ musicianUserId })
        .sort({ createdAt: -1 })
        .limit(200)
        .exec();

      return res.json({
        requests: requests.map((r) => serializeArtistRequest(r)),
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("GET /artist-requests/mine error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

// Musician decides on an incoming artist request.
router.post(
  "/:id/decision",
  requireRole("musician"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const { decision } = req.body as { decision: "accept" | "decline" };

      if (decision !== "accept" && decision !== "decline") {
        return res.status(400).json({ message: "Invalid decision" });
      }

      const request = await ArtistRequest.findById(id).exec();
      if (!request) {
        return res.status(404).json({ message: "Not found" });
      }

      const musicianUserId = String(req.authUser!.id);
      if (String(request.musicianUserId) !== musicianUserId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      if (request.status !== "pending") {
        return res
          .status(400)
          .json({ message: "Request is already decided or cancelled" });
      }

      request.status = decision === "accept" ? "accepted" : "declined";
      request.decidedAt = new Date();
      request.decidedByUserId = new mongoose.Types.ObjectId(musicianUserId);
      await request.save();

      return res.json({
        id: request.id,
        status: request.status,
        decidedAt: request.decidedAt,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /artist-requests/:id/decision error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

export default router;
