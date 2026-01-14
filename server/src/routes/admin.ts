import type { Response, Router } from "express";
import express from "express";
import crypto from "crypto";
import { User } from "../models/User";
import { Invite } from "../models/Invite";
import { deriveDefaultPermissions, type EmployeeRole } from "../lib/access";
import {
  requirePermission,
  requireRole,
  type AuthenticatedRequest,
} from "../middleware/auth";

const router: Router = express.Router();

// Admin-only user management (minimal MVP)

router.get(
  "/users",
  requireRole("admin"),
  async (_req: AuthenticatedRequest, res: Response) => {
    const users = await User.find({}).sort({ createdAt: -1 }).limit(200).exec();

    return res.json({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        roles: u.roles,
        permissions: u.permissions,
        employeeRoles: u.employeeRoles,
      })),
    });
  }
);

router.patch(
  "/users/:id",
  requireRole("admin"),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params as { id: string };

    const { roles, permissions, employeeRoles } = req.body as {
      roles?: string[];
      permissions?: string[];
      employeeRoles?: string[];
    };

    const user = await User.findById(id).exec();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (roles) {
      if (roles.includes("admin") && !user.roles.includes("admin")) {
        return res.status(403).json({
          message:
            "Assigning admin role is owner-only. Use the owner promotion endpoint.",
        });
      }
      user.roles = roles;
    }
    if (permissions) user.permissions = permissions as any;
    if (employeeRoles) user.employeeRoles = employeeRoles as any;

    await user.save();

    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      employeeRoles: user.employeeRoles,
    });
  }
);

// Employee onboarding invites (admin creates, employee redeems via /auth/register-invite)

router.post(
  "/invites/employee",
  requireRole("admin"),
  requirePermission("manage_employees"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email, expiresInHours, employeeRoles } = req.body as {
        email: string;
        expiresInHours?: number;
        employeeRoles?: EmployeeRole[];
      };

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const ttlHours = Math.max(
        1,
        Math.min(72, Number(expiresInHours ?? 24) || 24)
      );

      const token = crypto.randomBytes(32).toString("base64url");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

      await Invite.create({
        tokenHash,
        email: normalizedEmail,
        roles: ["rental_provider"],
        permissions: deriveDefaultPermissions(["rental_provider"]),
        employeeRoles: employeeRoles ?? [],
        expiresAt,
        createdByUserId: req.authUser?.id,
      });

      return res.status(201).json({
        token,
        email: normalizedEmail,
        expiresAt,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("/admin/invites/employee error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.get(
  "/invites/employee",
  requireRole("admin"),
  requirePermission("manage_employees"),
  async (_req: AuthenticatedRequest, res: Response) => {
    const invites = await Invite.find({
      roles: { $in: ["rental_provider"] },
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .exec();

    return res.json({
      invites: invites.map((i) => ({
        id: i.id,
        email: i.email,
        roles: i.roles,
        employeeRoles: i.employeeRoles,
        expiresAt: i.expiresAt,
        usedAt: i.usedAt,
        revokedAt: i.revokedAt,
        createdAt: (i as any).createdAt,
      })),
    });
  }
);

router.post(
  "/invites/employee/:id/revoke",
  requireRole("admin"),
  requirePermission("manage_employees"),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params as { id: string };

    const invite = await Invite.findById(id).exec();
    if (!invite) {
      return res.status(404).json({ message: "Invite not found" });
    }

    if (invite.revokedAt) {
      return res.json({
        id: invite.id,
        revokedAt: invite.revokedAt,
      });
    }

    if (invite.usedAt) {
      return res
        .status(409)
        .json({ message: "Invite already used and cannot be revoked" });
    }

    invite.revokedAt = new Date();
    invite.revokedByUserId = req.authUser?.id;
    await invite.save();

    return res.json({
      id: invite.id,
      revokedAt: invite.revokedAt,
    });
  }
);

export default router;
