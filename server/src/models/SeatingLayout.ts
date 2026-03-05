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

  /** Optional row grouping identifier used by the editor */
  rowGroupId?: string;
  /** If true, this seat will not be affected by row-level moves/reflows */
  detachedFromRow?: boolean;
}

export interface ILayoutElement {
  elementId: string;
  type: "aisle" | "table" | "railing" | "stairs" | "dance_floor" | "entrance";
  floorId?: string;
  /** Used by aisle lines */
  orientation?: "vertical" | "horizontal";
  /** World coordinates (same coordinate system as seat posX/posY) */
  x: number;
  y: number;
  /** Size in world units */
  length?: number;
  thickness?: number;
  label?: string;
  /** For table elements */
  tableShape?: "round" | "rect";
  /** Table width (also used as diameter for round) */
  width?: number;
  /** Table height (used for rect tables) */
  height?: number;
  /** Number of seats around this table (links to seat rowGroupId = "table-{elementId}") */
  seatCount?: number;
  /** Direction for stairs/entrance arrows: up, down, left, right */
  arrowDir?: "up" | "down" | "left" | "right";
  /** Accessibility note */
  accessibilityNote?: string;
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
  /** Optional layout elements (e.g., aisles, tables, railings) used by the editor */
  elements?: ILayoutElement[];
  /** Optional room boundary in feet for the canvas visualizer */
  roomBoundary?: { width: number; height: number };
  /** Optional editor background image (distinct from the venue cover image) */
  backgroundImageUrl?: string;
  /** Stored binary for uploaded background image */
  backgroundImageBlob?: {
    filename: string;
    mimeType: string;
    data: Buffer;
  };
  /** Last AI analysis result from Qwen VL */
  aiSuggestions?: {
    analyzedAt: Date;
    model: string;
    description?: string;
    stagePosition?: "top" | "bottom" | "left" | "right";
    capacityEstimate?: number;
    suggestions: Array<{
      type:
        | "stage"
        | "aisle"
        | "table"
        | "railing"
        | "stairs"
        | "dance_floor"
        | "entrance"
        | "seating_zone";
      label: string;
      xPct: number;
      yPct: number;
      widthPct?: number;
      heightPct?: number;
      estimatedSeats?: number;
      notes?: string;
    }>;
  };
  /** Stage configuration stored in world coordinates */
  stage?: {
    x: number;
    y: number;
    width: number;
    height: number;
    shape?: "rect" | "rounded";
    cornerRadius?: number;
  };
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
    rowGroupId: { type: String },
    detachedFromRow: { type: Boolean, default: false },
  },
  { _id: false },
);

const LayoutElementSchema = new Schema<ILayoutElement>(
  {
    elementId: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ["aisle", "table", "railing", "stairs", "dance_floor", "entrance"],
    },
    floorId: { type: String },
    orientation: { type: String, enum: ["vertical", "horizontal"] },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    length: { type: Number, min: 0 },
    thickness: { type: Number, min: 0 },
    label: { type: String },
    tableShape: { type: String, enum: ["round", "rect"] },
    width: { type: Number },
    height: { type: Number },
    seatCount: { type: Number },
    arrowDir: { type: String, enum: ["up", "down", "left", "right"] },
    accessibilityNote: { type: String },
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
    elements: [LayoutElementSchema],
    backgroundImageUrl: { type: String },
    backgroundImageBlob: {
      filename: { type: String },
      mimeType: { type: String },
      data: { type: Buffer },
    },
    aiSuggestions: {
      analyzedAt: { type: Date },
      model: { type: String },
      description: { type: String },
      stagePosition: { type: String, enum: ["top", "bottom", "left", "right"] },
      capacityEstimate: { type: Number },
      suggestions: [
        {
          type: {
            type: String,
            enum: [
              "stage",
              "aisle",
              "table",
              "railing",
              "stairs",
              "dance_floor",
              "entrance",
              "seating_zone",
            ],
          },
          label: { type: String },
          xPct: { type: Number },
          yPct: { type: Number },
          widthPct: { type: Number },
          heightPct: { type: Number },
          estimatedSeats: { type: Number },
          notes: { type: String },
        },
      ],
    },
    roomBoundary: {
      width: { type: Number },
      height: { type: Number },
    },
    stage: {
      x: { type: Number },
      y: { type: Number },
      width: { type: Number },
      height: { type: Number },
      shape: { type: String, enum: ["rect", "rounded"] },
      cornerRadius: { type: Number },
    },
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
