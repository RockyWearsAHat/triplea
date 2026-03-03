import { Schema, model, type Document, Types } from "mongoose";

export interface ISeatHold extends Document {
  gigId: Types.ObjectId;
  layoutId?: Types.ObjectId;
  seatId: string;
  holdKey: string;
  userId?: Types.ObjectId | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SeatHoldSchema = new Schema<ISeatHold>(
  {
    gigId: {
      type: Schema.Types.ObjectId,
      ref: "Gig",
      required: true,
      index: true,
    },
    layoutId: {
      type: Schema.Types.ObjectId,
      ref: "SeatingLayout",
      index: true,
    },
    seatId: { type: String, required: true },
    holdKey: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Prevent two holds for the same seat
SeatHoldSchema.index({ gigId: 1, seatId: 1 }, { unique: true });

// TTL to automatically remove expired holds
SeatHoldSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SeatHold = model<ISeatHold>("SeatHold", SeatHoldSchema);
