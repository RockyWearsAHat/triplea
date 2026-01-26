import { Schema, model, type Document, Types } from "mongoose";

/**
 * Ticket tier types represent different levels of access/seating
 * - general_admission: Standing/any available seat
 * - reserved: Specific assigned seat
 * - vip: Premium section with additional perks
 * - premium: Better seats/viewing area
 */
export type TicketTierType =
  | "general_admission"
  | "reserved"
  | "vip"
  | "premium";

export interface ITicketTier extends Document {
  /** The gig/concert this tier belongs to */
  gigId: Types.ObjectId;
  /** Tier name (e.g., "General Admission", "VIP", "Front Row") */
  name: string;
  /** Optional description of what this tier includes */
  description?: string;
  /** Type of tier for display and logic */
  tierType: TicketTierType;
  /** Price per ticket in this tier (in dollars) */
  price: number;
  /** Total number of tickets available in this tier */
  capacity: number;
  /** Number of tickets sold in this tier */
  sold: number;
  /** Whether this tier is currently available for sale */
  available: boolean;
  /** Sort order for display (lower = first) */
  sortOrder: number;
  /** Optional color for UI display (hex) */
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TicketTierSchema = new Schema<ITicketTier>(
  {
    gigId: {
      type: Schema.Types.ObjectId,
      ref: "Gig",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    description: { type: String },
    tierType: {
      type: String,
      enum: ["general_admission", "reserved", "vip", "premium"],
      default: "general_admission",
    },
    price: { type: Number, required: true, min: 0 },
    capacity: { type: Number, required: true, min: 0 },
    sold: { type: Number, default: 0, min: 0 },
    available: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    color: { type: String },
  },
  { timestamps: true },
);

// Index for finding tiers by gig
TicketTierSchema.index({ gigId: 1, sortOrder: 1 });

// Virtual for remaining tickets
TicketTierSchema.virtual("remaining").get(function () {
  return Math.max(0, this.capacity - this.sold);
});

// Method to check if tickets can be purchased
TicketTierSchema.methods.canPurchase = function (quantity: number): boolean {
  return this.available && this.sold + quantity <= this.capacity;
};

// Static method to get all tiers for a gig
TicketTierSchema.statics.findByGig = function (gigId: Types.ObjectId) {
  return this.find({ gigId }).sort({ sortOrder: 1 }).exec();
};

export const TicketTier = model<ITicketTier>("TicketTier", TicketTierSchema);
