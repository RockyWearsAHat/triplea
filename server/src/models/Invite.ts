import { Schema, model, type Document } from "mongoose";
import type { EmployeeRole, Permission, Role } from "../lib/access";

export interface IInvite extends Document {
  tokenHash: string;
  email: string;
  roles: Role[];
  permissions: Permission[];
  employeeRoles: EmployeeRole[];
  expiresAt: Date;
  usedAt?: Date;
  revokedAt?: Date;
  revokedByUserId?: string;
  usedByUserId?: string;
  createdByUserId?: string;
}

const InviteSchema = new Schema<IInvite>(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, index: true },
    roles: { type: [String], required: true },
    permissions: { type: [String], default: [] },
    employeeRoles: { type: [String], default: [] },
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date },
    revokedAt: { type: Date },
    revokedByUserId: { type: String },
    usedByUserId: { type: String },
    createdByUserId: { type: String },
  },
  { timestamps: true }
);

export const Invite = model<IInvite>("Invite", InviteSchema);
