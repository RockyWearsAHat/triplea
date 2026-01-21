import { Schema, model, type Document, Types } from "mongoose";

export type ArtistRequestStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled";

export interface IArtistRequest extends Document {
  gigId: Types.ObjectId;
  musicianUserId: Types.ObjectId;
  createdByUserId: Types.ObjectId;
  priceOffered: number;
  message?: string;
  status: ArtistRequestStatus;
  decidedAt?: Date | null;
  decidedByUserId?: Types.ObjectId | null;
}

const ArtistRequestSchema = new Schema<IArtistRequest>(
  {
    gigId: { type: Schema.Types.ObjectId, ref: "Gig", required: true },
    musicianUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    priceOffered: { type: Number, required: true },
    message: { type: String },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "cancelled"],
      default: "pending",
    },
    decidedAt: { type: Date },
    decidedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const ArtistRequest = model<IArtistRequest>(
  "ArtistRequest",
  ArtistRequestSchema,
);
