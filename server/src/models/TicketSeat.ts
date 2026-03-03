import { Schema, model, type Document, Types } from "mongoose";

export interface ITicketSeat extends Document {
  gigId: Types.ObjectId;
  ticketId: Types.ObjectId;
  layoutId?: Types.ObjectId;
  seatId: string;
  section?: string;
  row?: string;
  seatNumber?: string;
  status: "valid" | "used" | "cancelled" | "expired";
  createdAt: Date;
  updatedAt: Date;
}

const TicketSeatSchema = new Schema<ITicketSeat>(
  {
    gigId: {
      type: Schema.Types.ObjectId,
      ref: "Gig",
      required: true,
      index: true,
    },
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: "Ticket",
      required: true,
      index: true,
    },
    layoutId: {
      type: Schema.Types.ObjectId,
      ref: "SeatingLayout",
      index: true,
    },
    seatId: { type: String, required: true },
    section: { type: String },
    row: { type: String },
    seatNumber: { type: String },
    status: {
      type: String,
      enum: ["valid", "used", "cancelled", "expired"],
      default: "valid",
      index: true,
    },
  },
  { timestamps: true },
);

// Unique active seat per gig
TicketSeatSchema.index({ gigId: 1, seatId: 1 }, { unique: true });

export const TicketSeat = model<ITicketSeat>("TicketSeat", TicketSeatSchema);
