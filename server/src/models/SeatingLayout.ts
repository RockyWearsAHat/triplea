import { Schema, model, type Document, Types } from "mongoose";

/**
 * Represents a single seat in a venue
 */
export interface ISeat {
  /** Unique identifier for the seat within the layout */
  seatId: string;
  /** Row identifier (e.g., "A", "B", "1", "2") */
  row: string;
  /** Seat number within the row */
  seatNumber: string;
  /** Section name (e.g., "Orchestra", "Balcony", "VIP") */
  section: string;
  /** Floor identifier (e.g., "floor-1", "balcony") */
  floorId?: string;
  /** Associated ticket tier ID for pricing */
  tierId?: Types.ObjectId;
  /** X position for visual layout (percentage 0-100) */
  posX?: number;
  /** Y position for visual layout (percentage 0-100) */
  posY?: number;
  /** Whether this seat is available (not blocked/reserved by venue) */
  isAvailable: boolean;
  /** Accessibility features for this seat */
  accessibility?: string[];
}

export interface IFloor {
  /** Floor identifier */
  floorId: string;
  /** Display name */
  name: string;
  /** Sort order (lower first) */
  order: number;
}

/**
 * Represents a section in the venue (e.g., Orchestra, Balcony)
 */
export interface ISection {
  /** Section identifier */
  sectionId: string;
  /** Display name for the section */
  name: string;
  /** Floor identifier this section belongs to */
  floorId?: string;
  /** Color for UI display (hex) */
  color?: string;
  /** Default tier for seats in this section */
  defaultTierId?: Types.ObjectId;
  /** List of rows in this section */
  rows: string[];
  /** Number of seats per row (can vary) */
  seatsPerRow: number[];
}

/**
 * Seating layout for a venue, reusable across multiple events
 */
export interface ISeatingLayout extends Document {
  /** Name of this layout (e.g., "Main Theater - Standard", "Outdoor Stage - Concert") */
  name: string;
  /** Location/venue this layout belongs to */
  locationId: Types.ObjectId;
  /** User who created this layout */
  createdByUserId: Types.ObjectId;
  /** Brief description of the layout */
  description?: string;
  /** Total seat capacity in this layout */
  totalCapacity: number;
  /** Sections in this layout */
  sections: ISection[];
  /** All individual seats */
  seats: ISeat[];
  /** Floors/levels for this venue */
  floors?: IFloor[];
  /** Whether this layout is a template that can be cloned */
  isTemplate: boolean;
  /** Stage/screen position for visualization (top, bottom, left, right) */
  stagePosition?: "top" | "bottom" | "left" | "right";
  createdAt: Date;
  updatedAt: Date;
}

const SeatSchema = new Schema<ISeat>(
  {
    seatId: { type: String, required: true },
    row: { type: String, required: true },
    seatNumber: { type: String, required: true },
    section: { type: String, required: true },
    floorId: { type: String },
    tierId: { type: Schema.Types.ObjectId, ref: "TicketTier" },
    posX: { type: Number },
    posY: { type: Number },
    isAvailable: { type: Boolean, default: true },
    accessibility: [{ type: String }],
  },
  { _id: false },
);

const SectionSchema = new Schema<ISection>(
  {
    sectionId: { type: String, required: true },
    name: { type: String, required: true },
    floorId: { type: String },
    color: { type: String },
    defaultTierId: { type: Schema.Types.ObjectId, ref: "TicketTier" },
    rows: [{ type: String }],
    seatsPerRow: [{ type: Number }],
  },
  { _id: false },
);

const FloorSchema = new Schema<IFloor>(
  {
    floorId: { type: String, required: true },
    name: { type: String, required: true },
    order: { type: Number, required: true },
  },
  { _id: false },
);

const SeatingLayoutSchema = new Schema<ISeatingLayout>(
  {
    name: { type: String, required: true },
    locationId: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
      index: true,
    },
    createdByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    description: { type: String },
    totalCapacity: { type: Number, required: true, min: 0 },
    sections: [SectionSchema],
    seats: [SeatSchema],
    floors: [FloorSchema],
    isTemplate: { type: Boolean, default: false },
    stagePosition: {
      type: String,
      enum: ["top", "bottom", "left", "right"],
      default: "top",
    },
  },
  { timestamps: true },
);

// Index for finding layouts by location
SeatingLayoutSchema.index({ locationId: 1, isTemplate: 1 });

// Static method to generate a simple layout
SeatingLayoutSchema.statics.generateSimpleLayout = function (params: {
  name: string;
  locationId: Types.ObjectId;
  createdByUserId: Types.ObjectId;
  sections: Array<{
    name: string;
    rows: number;
    seatsPerRow: number;
    tierId?: Types.ObjectId;
    color?: string;
  }>;
}) {
  const seats: ISeat[] = [];
  const sectionDefs: ISection[] = [];
  let totalCapacity = 0;
  const defaultFloorId = "floor-1";

  params.sections.forEach((sec, secIdx) => {
    const sectionId = `section-${secIdx}`;
    const rowLetters: string[] = [];
    const seatsPerRow: number[] = [];

    for (let r = 0; r < sec.rows; r++) {
      const rowLetter = String.fromCharCode(65 + r); // A, B, C, ...
      rowLetters.push(rowLetter);
      seatsPerRow.push(sec.seatsPerRow);

      for (let s = 1; s <= sec.seatsPerRow; s++) {
        const seatId = `${sectionId}-${rowLetter}-${s}`;
        seats.push({
          seatId,
          row: rowLetter,
          seatNumber: String(s),
          section: sec.name,
          floorId: defaultFloorId,
          tierId: sec.tierId,
          posX: (s / (sec.seatsPerRow + 1)) * 100,
          posY:
            ((secIdx * sec.rows + r + 1) / (params.sections.length * 10)) * 100,
          isAvailable: true,
        });
        totalCapacity++;
      }
    }

    sectionDefs.push({
      sectionId,
      name: sec.name,
      floorId: defaultFloorId,
      color: sec.color,
      defaultTierId: sec.tierId,
      rows: rowLetters,
      seatsPerRow,
    });
  });

  return new this({
    name: params.name,
    locationId: params.locationId,
    createdByUserId: params.createdByUserId,
    totalCapacity,
    sections: sectionDefs,
    seats,
    floors: [{ floorId: defaultFloorId, name: "Main Floor", order: 0 }],
    isTemplate: false,
  });
};

export const SeatingLayout = model<ISeatingLayout>(
  "SeatingLayout",
  SeatingLayoutSchema,
);
