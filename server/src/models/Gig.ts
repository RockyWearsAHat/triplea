import { Schema, model, type Document, Types } from "mongoose";

export type GigStatus = "open" | "cancelled" | "filled";

export interface IGig extends Document {
  title: string;
  description?: string;
  date: string; // ISO yyyy-mm-dd
  time?: string; // HH:MM
  budget?: number;
  locationId?: Types.ObjectId;
  createdByUserId: Types.ObjectId;
  status: GigStatus;
}

const GigSchema = new Schema<IGig>(
  {
    title: { type: String, required: true },
    description: { type: String },
    date: { type: String, required: true },
    time: { type: String },
    budget: { type: Number },
    locationId: { type: Schema.Types.ObjectId, ref: "Location" },
    createdByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["open", "cancelled", "filled"],
      default: "open",
    },
  },
  { timestamps: true }
);

export const Gig = model<IGig>("Gig", GigSchema);
