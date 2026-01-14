import type { Request, Response, Router } from "express";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User";

const router: Router = express.Router();

const JWT_COOKIE = "triplea_jwt";
const JWT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getJwtSecret(): string {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set");
  }
  return process.env.JWT_SECRET;
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

    const user = await User.create({
      name,
      email,
      passwordHash,
      roles: roles && roles.length ? roles : ["customer"],
    });

    return res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      roles: user.roles,
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
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        roles: user.roles,
      },
      getJwtSecret(),
      { expiresIn: "7d" }
    );

    res.cookie(JWT_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: JWT_MAX_AGE_MS,
    });

    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      roles: user.roles,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/login error", err);
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
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/me error", err);
    return res.status(200).json({ user: null });
  }
});

export default router;
