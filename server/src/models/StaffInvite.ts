import { Schema, model, type Document, Types } from "mongoose";

/**
 * Permissions that a host can grant to their staff members.
 * These are scoped to the host's events/venues only.
 */
export type StaffPermission =
  | "scan_tickets" // Can scan tickets at events
  | "view_sales" // Can view ticket sales and revenue
  | "manage_events" // Can create/edit events
  | "manage_venues" // Can manage venue listings
  | "send_messages"; // Can message musicians on behalf of host

export const STAFF_PERMISSIONS: StaffPermission[] = [
  "scan_tickets",
  "view_sales",
  "manage_events",
  "manage_venues",
  "send_messages",
];

export type StaffInviteStatus = "pending" | "accepted" | "revoked" | "expired";

export interface IStaffInvite extends Document {
  /** The host user who created this invite */
  hostUserId: Types.ObjectId;
  /** Email address of the invitee */
  email: string;
  /** Display name for the staff member (optional, can be set by invitee) */
  staffName?: string;
  /** Permissions granted to this staff member */
  permissions: StaffPermission[];
  /** Secure token hash for the invite link */
  tokenHash: string;
  /** Status of the invite */
  status: StaffInviteStatus;
  /** When the invite expires */
  expiresAt: Date;
  /** If accepted, the user ID of the staff member */
  linkedUserId?: Types.ObjectId;
  /** When the invite was accepted */
  acceptedAt?: Date;
  /** When the invite was revoked */
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StaffInviteSchema = new Schema<IStaffInvite>(
  {
    hostUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    email: { type: String, required: true, index: true },
    staffName: { type: String },
    permissions: {
      type: [String],
      enum: STAFF_PERMISSIONS,
      default: ["scan_tickets"],
    },
    tokenHash: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "revoked", "expired"],
      default: "pending",
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    linkedUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    acceptedAt: { type: Date },
    revokedAt: { type: Date },
  },
  { timestamps: true },
);

// Compound index for finding staff by host
StaffInviteSchema.index({ hostUserId: 1, status: 1 });
// Compound index for finding invites by email
StaffInviteSchema.index({ email: 1, status: 1 });

export const StaffInvite = model<IStaffInvite>(
  "StaffInvite",
  StaffInviteSchema,
);
