import { Schema, model, type Document, Types } from "mongoose";

export type GigStatus = "open" | "cancelled" | "filled";
export type GigType = "musician-wanted" | "public-concert";
export type SeatingType = "general_admission" | "reserved" | "mixed";

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
  /** For public concerts: ticket price in dollars (default/GA price) */
  ticketPrice?: number;
  /** Type of seating arrangement for the event */
  seatingType?: SeatingType;
  /** Override seat capacity (if different from venue default) */
  seatCapacity?: number;
  /** Reference to seating layout for reserved seating */
  seatingLayoutId?: Types.ObjectId;
  /** Whether the concert has multiple ticket tiers configured */
  hasTicketTiers?: boolean;
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
    seatingType: {
      type: String,
      enum: ["general_admission", "reserved", "mixed"],
      default: "general_admission",
    },
    seatCapacity: { type: Number, min: 0 },
    seatingLayoutId: { type: Schema.Types.ObjectId, ref: "SeatingLayout" },
    hasTicketTiers: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Gig = model<IGig>("Gig", GigSchema);
