import type { Response, Router } from "express";
import express from "express";
import { Instrument } from "../models/Instrument";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";

const router: Router = express.Router();

function ensureInstrumentManager(
  req: AuthenticatedRequest,
  res: Response,
): boolean {
  const user = req.authUser;
  if (!user) {
    res.status(401).json({ message: "Not authenticated" });
    return false;
  }

  const roles = user.roles ?? [];
  const allowed = roles.includes("admin") || roles.includes("rental_provider");
  if (!allowed) {
    res.status(403).json({ message: "Forbidden" });
    return false;
  }
  return true;
}

// Admin/employee-only: create a new instrument listing for the Muse marketplace.
router.post(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!ensureInstrumentManager(req, res)) return;

      const { name, category, dailyRate, available } = req.body as {
        name?: string;
        category?: string;
        dailyRate?: number;
        available?: boolean;
      };

      if (!name || !category || typeof dailyRate !== "number") {
        return res.status(400).json({
          message: "name, category, and dailyRate are required",
        });
      }

      const instrument = await Instrument.create({
        name: name.trim(),
        category: category.trim(),
        dailyRate,
        available: typeof available === "boolean" ? available : true,
        images: [],
      });

      return res.status(201).json({
        id: instrument.id,
        name: instrument.name,
        category: instrument.category,
        dailyRate: instrument.dailyRate,
        available: instrument.available,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /instruments error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

export default router;
