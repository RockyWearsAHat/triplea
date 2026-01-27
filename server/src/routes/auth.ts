import type { Request, Response, Router } from "express";
import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { Invite } from "../models/Invite";
import { deriveDefaultPermissions } from "../lib/access";
import { sendPasswordResetEmail } from "../lib/email";

const router: Router = express.Router();

const JWT_COOKIE = "triplea_jwt";
const JWT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getJwtSecret(): string {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set");
  }
  return process.env.JWT_SECRET;
}

function issueAuthCookie(
  res: Response,
  user: { id: string; email: string; roles: string[] },
) {
  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      roles: user.roles,
    },
    getJwtSecret(),
    { expiresIn: "7d" },
  );

  res.cookie(JWT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: JWT_MAX_AGE_MS,
  });
}

router.post("/register", async (req: Request, res: Response) => {
  try {
    const { name, email, password, roles } = req.body as {
      name: string;
      email: string;
      password: string;
      roles?: string[];
    };

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const existing = await User.findOne({ email }).exec();
    if (existing) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const resolvedRoles = roles && roles.length ? roles : ["customer"];
    if (resolvedRoles.length !== 1) {
      return res
        .status(400)
        .json({ message: "Public registration supports exactly one role" });
    }

    const role = resolvedRoles[0];
    if (role !== "customer" && role !== "musician") {
      return res.status(403).json({
        message:
          "This account type cannot be registered publicly. Contact support if you were invited.",
      });
    }

    // Enforce canonical roles server-side; do not trust the client.
    const canonicalRoles = [role];
    const defaultPermissions = deriveDefaultPermissions(canonicalRoles);

    const user = await User.create({
      name,
      email,
      passwordHash,
      roles: canonicalRoles,
      permissions: defaultPermissions,
    });

    return res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      employeeRoles: user.employeeRoles,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/register error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      return res.status(400).json({ message: "Missing email or password" });
    }

    const user = await User.findOne({ email }).exec();

    // Always run a bcrypt comparison to reduce timing leaks (user enumeration).
    // This dummy hash is a valid bcrypt hash for a random password.
    const DUMMY_BCRYPT_HASH =
      "$2a$10$CwTycUXWue0Thq9StjUM0uJ8b2vNhpX6YsJhBKt3vnDnN/SfXlBx2";

    const ok = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_BCRYPT_HASH,
    );
    if (!user || !ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    issueAuthCookie(res, { id: user.id, email: user.email, roles: user.roles });

    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      employeeRoles: user.employeeRoles,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/login error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Invite-only registration for internal employees.
// The invite token is one-time-use, email-bound, and expires.
router.post("/register-invite", async (req: Request, res: Response) => {
  try {
    const { token, name, email, password } = req.body as {
      token: string;
      name: string;
      email: string;
      password: string;
    };

    if (!token || !name || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const tokenHash = crypto
      .createHash("sha256")
      .update(String(token))
      .digest("hex");

    const invite = await Invite.findOne({ tokenHash }).exec();
    if (!invite) {
      return res.status(400).json({ message: "Invalid or expired invite" });
    }
    if (invite.revokedAt) {
      return res.status(400).json({ message: "Invalid or expired invite" });
    }
    if (invite.usedAt) {
      return res.status(400).json({ message: "Invite has already been used" });
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired invite" });
    }
    if (invite.email !== normalizedEmail) {
      return res
        .status(403)
        .json({ message: "Invite is not valid for this email" });
    }

    const existing = await User.findOne({ email: normalizedEmail }).exec();
    if (existing) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Only allow employee roles via invite.
    const canonicalRoles = invite.roles;
    if (!canonicalRoles.includes("rental_provider")) {
      return res.status(400).json({ message: "Invite misconfigured" });
    }

    const user = await User.create({
      name,
      email: normalizedEmail,
      passwordHash,
      roles: canonicalRoles,
      permissions:
        invite.permissions ?? deriveDefaultPermissions(canonicalRoles),
      employeeRoles: invite.employeeRoles ?? [],
    });

    invite.usedAt = new Date();
    invite.usedByUserId = user.id;
    await invite.save();

    issueAuthCookie(res, { id: user.id, email: user.email, roles: user.roles });

    return res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      employeeRoles: user.employeeRoles,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/register-invite error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/logout", (req: Request, res: Response) => {
  res.clearCookie(JWT_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  return res.status(204).end();
});

router.get("/me", async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.[JWT_COOKIE];
    if (!token) {
      return res.status(200).json({ user: null });
    }

    const decoded = jwt.verify(token, getJwtSecret()) as {
      sub: string;
      email: string;
      roles: string[];
    };

    const user = await User.findById(decoded.sub).exec();
    if (!user) {
      return res.status(200).json({ user: null });
    }

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: user.roles,
        permissions: user.permissions,
        employeeRoles: user.employeeRoles,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/me error", err);
    return res.status(200).json({ user: null });
  }
});

// Request password reset - sends an email with a reset link
router.post("/request-password-reset", async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email: string };

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).exec();

    // Always return success to prevent email enumeration attacks
    if (!user) {
      return res.json({
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    }

    // Generate a secure reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Token expires in 1 hour
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

    // Save the hashed token to the user
    user.passwordResetToken = resetTokenHash;
    user.passwordResetExpires = resetExpires;
    await user.save();

    // Send the email with the plain token (user will use this in the URL)
    await sendPasswordResetEmail({
      email: user.email,
      resetToken,
      userName: user.name,
    });

    return res.json({
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/request-password-reset error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Reset password using the token from email
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body as {
      token: string;
      newPassword: string;
    };

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ message: "Token and new password are required" });
    }

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters" });
    }

    // Hash the token to compare with stored hash
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with matching token that hasn't expired
    const user = await User.findOne({
      passwordResetToken: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    }).exec();

    if (!user) {
      return res.status(400).json({
        message:
          "Invalid or expired reset link. Please request a new password reset.",
      });
    }

    // Update the password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return res.json({
      message: "Password has been reset successfully. You can now log in.",
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/reset-password error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
