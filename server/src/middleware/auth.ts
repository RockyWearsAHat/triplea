import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User, type IUser } from "../models/User";
import type { Permission, Role } from "../lib/access";

const JWT_COOKIE = "triplea_jwt";

function getJwtSecret(): string {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set");
  }
  return process.env.JWT_SECRET;
}

export type AuthenticatedRequest = Request & {
  authUser?: IUser;
  // Multer file upload properties
  file?: Express.Multer.File;
  files?:
    | Express.Multer.File[]
    | { [fieldname: string]: Express.Multer.File[] };
};

export async function attachUser(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) {
  try {
    const token = (req as any).cookies?.[JWT_COOKIE];
    if (!token) {
      req.authUser = undefined;
      return next();
    }

    const decoded = jwt.verify(token, getJwtSecret()) as {
      sub: string;
    };

    const user = await User.findById(decoded.sub).exec();
    req.authUser = user ?? undefined;
    return next();
  } catch {
    req.authUser = undefined;
    return next();
  }
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.authUser) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  return next();
}

export function requireRole(role: Role) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (!req.authUser.roles.includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return next();
  };
}

export function requirePermission(permission: Permission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const perms = req.authUser.permissions ?? [];
    if (!perms.includes(permission)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return next();
  };
}
