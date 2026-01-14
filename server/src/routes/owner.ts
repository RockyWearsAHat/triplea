import type { Request, Response, Router } from "express";
import express from "express";
import { User } from "../models/User";
import { deriveDefaultPermissions } from "../lib/access";

const router: Router = express.Router();

function requireOwner(req: Request, res: Response): boolean {
  const secret = process.env.OWNER_SECRET;
  if (!secret) {
    res.status(500).json({ message: "OWNER_SECRET is not set" });
    return false;
  }

  const provided = String(req.header("x-owner-secret") ?? "");
  if (!provided || provided !== secret) {
    res.status(403).json({ message: "Forbidden" });
    return false;
  }

  return true;
}

// Owner-only: promote an existing user to admin.
// This is intentionally not exposed in any UI.
router.post("/promote-admin", async (req: Request, res: Response) => {
  if (!requireOwner(req, res)) return;

  const { email, userId } = req.body as { email?: string; userId?: string };
  if (!email && !userId) {
    return res.status(400).json({ message: "Provide either email or userId" });
  }

  const user = userId
    ? await User.findById(userId).exec()
    : await User.findOne({ email: String(email).trim().toLowerCase() }).exec();

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (!user.roles.includes("admin")) {
    user.roles = Array.from(new Set(["admin", ...user.roles]));
  }

  // Recompute permissions to ensure admin baseline.
  user.permissions = deriveDefaultPermissions(user.roles);

  await user.save();

  return res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles,
    permissions: user.permissions,
    employeeRoles: user.employeeRoles,
  });
});

export default router;
