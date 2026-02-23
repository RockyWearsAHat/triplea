import { Schema, model, type Document } from "mongoose";

export type ColorRating =
  | "gold"
  | "light-gold"
  | "blue"
  | "light-blue"
  | "purple"
  | "light-purple";

export interface IMusicianProfile extends Document {
  userId?: string;
  instruments: string[];
  genres: string[];
  bio?: string;
  averageRating: number;
  reviewCount: number;
  /** Likeability rating (color) separate from star rating. */
  colorRating?: ColorRating;
  /** Typical time (in days) needed to learn/memorize a requested piece. */
  learnSpeed?: number;
  /** Rough playing skill indicator used by future scoring logic. */
  skillLevel?: number;
  defaultHourlyRate?: number | null;
  acceptsDirectRequests?: boolean;
}

const MusicianProfileSchema = new Schema<IMusicianProfile>(
  {
    userId: { type: String },
    instruments: { type: [String], default: [] },
    genres: { type: [String], default: [] },
    bio: { type: String },
    averageRating: { type: Number, required: true },
    reviewCount: { type: Number, required: true },
    colorRating: {
      type: String,
      enum: [
        "gold",
        "light-gold",
        "blue",
        "light-blue",
        "purple",
        "light-purple",
      ],
      default: "light-blue",
    },
    learnSpeed: { type: Number, min: 1, max: 365, default: 14 },
    skillLevel: { type: Number, min: 1, max: 10, default: 5 },
    defaultHourlyRate: { type: Number, default: null },
    acceptsDirectRequests: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const MusicianProfile = model<IMusicianProfile>(
  "MusicianProfile",
  MusicianProfileSchema,
);
