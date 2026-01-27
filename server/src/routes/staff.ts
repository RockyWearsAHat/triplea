import type { Request, Response, Router } from "express";
import express from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { User } from "../models/User";
import {
  StaffInvite,
  STAFF_PERMISSIONS,
  type StaffPermission,
} from "../models/StaffInvite";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { sendStaffInviteEmail } from "../lib/email";

const router: Router = express.Router();

/**
 * Host Staff Management Routes
 *
 * These routes allow hosts (customers who create events) to manage their own staff.
 * Staff can be granted specific permissions scoped to that host's events/venues.
 */

// Create a staff invite
// POST /api/staff/invite
router.post(
  "/invite",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email, permissions, staffName } = req.body as {
        email: string;
        permissions?: StaffPermission[];
        staffName?: string;
      };

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const hostUserId = new Types.ObjectId(req.authUser!.id);

      // Validate permissions
      const validPermissions = (permissions ?? ["scan_tickets"]).filter((p) =>
        STAFF_PERMISSIONS.includes(p),
      );

      if (validPermissions.length === 0) {
        validPermissions.push("scan_tickets"); // Default permission
      }

      // Check if there's already a pending invite for this email from this host
      const existingInvite = await StaffInvite.findOne({
        hostUserId,
        email: normalizedEmail,
        status: "pending",
      }).exec();

      if (existingInvite) {
        return res.status(409).json({
          message: "An invite is already pending for this email",
        });
      }

      // Check if this person is already staff for this host
      const existingStaff = await StaffInvite.findOne({
        hostUserId,
        email: normalizedEmail,
        status: "accepted",
      }).exec();

      if (existingStaff) {
        return res.status(409).json({
          message: "This person is already on your staff",
        });
      }

      // Generate secure token
      const token = crypto.randomBytes(32).toString("base64url");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      // Invite expires in 7 days
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Check if user already exists in our system
      const existingUser = await User.findOne({
        email: normalizedEmail,
      }).exec();

      const invite = await StaffInvite.create({
        hostUserId,
        email: normalizedEmail,
        staffName: staffName || undefined,
        permissions: validPermissions,
        tokenHash,
        status: "pending",
        expiresAt,
      });

      // Get host name for the email
      const host = await User.findById(hostUserId).exec();

      // Send invite email
      await sendStaffInviteEmail({
        to: normalizedEmail,
        hostName: host?.name || "A Triple A Music host",
        token,
        isExistingUser: !!existingUser,
      });

      return res.status(201).json({
        invite: {
          id: invite.id,
          email: invite.email,
          staffName: invite.staffName,
          permissions: invite.permissions,
          status: invite.status,
          expiresAt: invite.expiresAt,
          createdAt: invite.createdAt,
        },
      });
    } catch (err) {
      console.error("POST /staff/invite error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

// List my staff members (both pending invites and active staff)
// GET /api/staff
router.get(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const hostUserId = new Types.ObjectId(req.authUser!.id);

      const staffRecords = await StaffInvite.find({
        hostUserId,
        status: { $in: ["pending", "accepted"] },
      })
        .populate("linkedUserId", "name email")
        .sort({ createdAt: -1 })
        .exec();

      const staff = staffRecords.map((s) => ({
        id: s.id,
        email: s.email,
        staffName: s.staffName || (s.linkedUserId as any)?.name || null,
        permissions: s.permissions,
        status: s.status,
        userId: s.linkedUserId ? String(s.linkedUserId) : null,
        acceptedAt: s.acceptedAt,
        expiresAt: s.expiresAt,
        createdAt: s.createdAt,
      }));

      return res.json({ staff });
    } catch (err) {
      console.error("GET /staff error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

// Update staff member permissions
// PATCH /api/staff/:id
router.patch(
  "/:id",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { permissions, staffName } = req.body as {
        permissions?: StaffPermission[];
        staffName?: string;
      };

      const hostUserId = new Types.ObjectId(req.authUser!.id);

      const staffRecord = await StaffInvite.findOne({
        _id: id,
        hostUserId,
      }).exec();

      if (!staffRecord) {
        return res.status(404).json({ message: "Staff member not found" });
      }

      if (permissions) {
        const validPermissions = permissions.filter((p) =>
          STAFF_PERMISSIONS.includes(p),
        );
        staffRecord.permissions = validPermissions;
      }

      if (staffName !== undefined) {
        staffRecord.staffName = staffName || undefined;
      }

      await staffRecord.save();

      return res.json({
        staff: {
          id: staffRecord.id,
          email: staffRecord.email,
          staffName: staffRecord.staffName,
          permissions: staffRecord.permissions,
          status: staffRecord.status,
        },
      });
    } catch (err) {
      console.error("PATCH /staff/:id error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

// Remove a staff member or revoke invite
// DELETE /api/staff/:id
router.delete(
  "/:id",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const hostUserId = new Types.ObjectId(req.authUser!.id);

      const staffRecord = await StaffInvite.findOne({
        _id: id,
        hostUserId,
      }).exec();

      if (!staffRecord) {
        return res.status(404).json({ message: "Staff member not found" });
      }

      staffRecord.status = "revoked";
      staffRecord.revokedAt = new Date();
      await staffRecord.save();

      return res.json({ success: true });
    } catch (err) {
      console.error("DELETE /staff/:id error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

// Resend invite email
// POST /api/staff/:id/resend
router.post(
  "/:id/resend",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const hostUserId = new Types.ObjectId(req.authUser!.id);

      const staffRecord = await StaffInvite.findOne({
        _id: id,
        hostUserId,
        status: "pending",
      }).exec();

      if (!staffRecord) {
        return res.status(404).json({ message: "Pending invite not found" });
      }

      // Generate new token
      const token = crypto.randomBytes(32).toString("base64url");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      // Extend expiration
      staffRecord.tokenHash = tokenHash;
      staffRecord.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await staffRecord.save();

      // Check if user exists
      const existingUser = await User.findOne({
        email: staffRecord.email,
      }).exec();
      const host = await User.findById(hostUserId).exec();

      await sendStaffInviteEmail({
        to: staffRecord.email,
        hostName: host?.name || "A Triple A Music host",
        token,
        isExistingUser: !!existingUser,
      });

      return res.json({ success: true, expiresAt: staffRecord.expiresAt });
    } catch (err) {
      console.error("POST /staff/:id/resend error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

// Update invitation email address
// PATCH /api/staff/:id/email
// This invalidates the old invite token and sends a new invite to the new email
router.patch(
  "/:id/email",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { email } = req.body as { email: string };
      const hostUserId = new Types.ObjectId(req.authUser!.id);

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const normalizedEmail = String(email).trim().toLowerCase();

      const staffRecord = await StaffInvite.findOne({
        _id: id,
        hostUserId,
        status: "pending",
      }).exec();

      if (!staffRecord) {
        return res.status(404).json({ message: "Pending invite not found" });
      }

      // If email is the same, just resend
      if (staffRecord.email === normalizedEmail) {
        // Generate new token and resend
        const token = crypto.randomBytes(32).toString("base64url");
        const tokenHash = crypto
          .createHash("sha256")
          .update(token)
          .digest("hex");

        staffRecord.tokenHash = tokenHash;
        staffRecord.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await staffRecord.save();

        const existingUser = await User.findOne({
          email: normalizedEmail,
        }).exec();
        const host = await User.findById(hostUserId).exec();

        await sendStaffInviteEmail({
          to: normalizedEmail,
          hostName: host?.name || "A Triple A Music host",
          token,
          isExistingUser: !!existingUser,
        });

        return res.json({
          success: true,
          email: staffRecord.email,
          expiresAt: staffRecord.expiresAt,
        });
      }

      // Check if there's already an invite for the NEW email from this host
      const existingInvite = await StaffInvite.findOne({
        hostUserId,
        email: normalizedEmail,
        status: "pending",
        _id: { $ne: id }, // exclude current record
      }).exec();

      if (existingInvite) {
        return res.status(409).json({
          message: "An invite is already pending for this email",
        });
      }

      // Check if someone with this email is already staff
      const existingStaff = await StaffInvite.findOne({
        hostUserId,
        email: normalizedEmail,
        status: "accepted",
      }).exec();

      if (existingStaff) {
        return res.status(409).json({
          message: "This person is already on your staff",
        });
      }

      // Generate new token (this invalidates the old one)
      const token = crypto.randomBytes(32).toString("base64url");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      // Update email and token
      staffRecord.email = normalizedEmail;
      staffRecord.tokenHash = tokenHash;
      staffRecord.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await staffRecord.save();

      // Check if new user exists
      const existingUser = await User.findOne({
        email: normalizedEmail,
      }).exec();
      const host = await User.findById(hostUserId).exec();

      // Send invite to new email
      await sendStaffInviteEmail({
        to: normalizedEmail,
        hostName: host?.name || "A Triple A Music host",
        token,
        isExistingUser: !!existingUser,
      });

      return res.json({
        success: true,
        email: staffRecord.email,
        expiresAt: staffRecord.expiresAt,
      });
    } catch (err) {
      console.error("PATCH /staff/:id/email error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

// ===== Public routes for accepting invites =====

// Get invite details by token (public, for the join page)
// GET /api/staff/join/:token
router.get("/join/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const invite = await StaffInvite.findOne({ tokenHash })
      .populate("hostUserId", "name")
      .exec();

    if (!invite) {
      return res.status(404).json({ message: "Invite not found" });
    }

    if (invite.status !== "pending") {
      return res
        .status(400)
        .json({ message: `Invite has been ${invite.status}` });
    }

    if (invite.expiresAt < new Date()) {
      return res.status(400).json({ message: "Invite has expired" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: invite.email }).exec();

    return res.json({
      invite: {
        email: invite.email,
        hostName: (invite.hostUserId as any)?.name || "A Triple A Music host",
        permissions: invite.permissions,
        isExistingUser: !!existingUser,
      },
    });
  } catch (err) {
    console.error("GET /staff/join/:token error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Accept invite - for existing users (just link)
// POST /api/staff/join/:token/link
router.post(
  "/join/:token/link",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { token } = req.params;
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      const invite = await StaffInvite.findOne({ tokenHash }).exec();

      if (!invite) {
        return res.status(404).json({ message: "Invite not found" });
      }

      if (invite.status !== "pending") {
        return res
          .status(400)
          .json({ message: `Invite has been ${invite.status}` });
      }

      if (invite.expiresAt < new Date()) {
        return res.status(400).json({ message: "Invite has expired" });
      }

      // Verify email matches
      const user = await User.findById(req.authUser!.id).exec();
      if (!user || user.email !== invite.email) {
        return res.status(403).json({
          message: "This invite was sent to a different email address",
        });
      }

      // Accept the invite
      invite.status = "accepted";
      invite.linkedUserId = user._id as Types.ObjectId;
      invite.acceptedAt = new Date();
      await invite.save();

      return res.json({ success: true, message: "You have joined the team!" });
    } catch (err) {
      console.error("POST /staff/join/:token/link error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

// Accept invite - for new users (create account)
// POST /api/staff/join/:token/register
router.post("/join/:token/register", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { name, password } = req.body as { name: string; password: string };

    if (!name || !password) {
      return res
        .status(400)
        .json({ message: "Name and password are required" });
    }

    if (password.length < 12) {
      return res
        .status(400)
        .json({ message: "Password must be at least 12 characters" });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const invite = await StaffInvite.findOne({ tokenHash }).exec();

    if (!invite) {
      return res.status(404).json({ message: "Invite not found" });
    }

    if (invite.status !== "pending") {
      return res
        .status(400)
        .json({ message: `Invite has been ${invite.status}` });
    }

    if (invite.expiresAt < new Date()) {
      return res.status(400).json({ message: "Invite has expired" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: invite.email }).exec();
    if (existingUser) {
      return res.status(409).json({
        message:
          "An account already exists with this email. Please log in instead.",
      });
    }

    // Create the user
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: invite.email,
      passwordHash,
      roles: ["customer"], // Staff are just customers with extra permissions via StaffInvite
      permissions: [],
      employeeRoles: [],
    });

    // Accept the invite
    invite.status = "accepted";
    invite.linkedUserId = user._id as Types.ObjectId;
    invite.acceptedAt = new Date();
    invite.staffName = invite.staffName || name;
    await invite.save();

    return res.status(201).json({
      success: true,
      message: "Account created! You can now log in.",
      userId: user.id,
    });
  } catch (err) {
    console.error("POST /staff/join/:token/register error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Get my staff memberships (for the current user - what hosts they work for)
// GET /api/staff/my-hosts
router.get(
  "/my-hosts",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = new Types.ObjectId(req.authUser!.id);

      const memberships = await StaffInvite.find({
        linkedUserId: userId,
        status: "accepted",
      })
        .populate("hostUserId", "name email")
        .exec();

      const hosts = memberships.map((m) => ({
        id: m.id,
        hostId: String(m.hostUserId),
        hostName: (m.hostUserId as any)?.name || "Unknown",
        hostEmail: (m.hostUserId as any)?.email,
        permissions: m.permissions,
        acceptedAt: m.acceptedAt,
      }));

      return res.json({ hosts });
    } catch (err) {
      console.error("GET /staff/my-hosts error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

export default router;
