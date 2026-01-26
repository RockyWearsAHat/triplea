import { Schema, model, type Document, Types } from "mongoose";

export type GigStatus = "open" | "cancelled" | "filled";
export type GigType = "musician-wanted" | "public-concert";

export interface IGig extends Document {
  title: string;
  description?: string;
  date: string; // ISO yyyy-mm-dd
  time?: string; // HH:MM
  budget?: number;
  locationId?: Types.ObjectId;
  createdByUserId: Types.ObjectId;
  status: GigStatus;
  /** "musician-wanted" = job posting for performers; "public-concert" = ticketed event for audiences */
  gigType: GigType;
  /** For public concerts: is ticket selling enabled? */
  openForTickets?: boolean;
  /** For public concerts: ticket price in dollars */
  ticketPrice?: number;
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
    gigType: {
      type: String,
      enum: ["musician-wanted", "public-concert"],
      default: "musician-wanted",
    },
    openForTickets: { type: Boolean, default: false },
    ticketPrice: { type: Number },
  },
  { timestamps: true },
);

export const Gig = model<IGig>("Gig", GigSchema);
