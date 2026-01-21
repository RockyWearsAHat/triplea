import { Schema, model, type Document } from "mongoose";

export interface IMusicianProfile extends Document {
  userId?: string;
  instruments: string[];
  genres: string[];
  bio?: string;
  averageRating: number;
  reviewCount: number;
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
    defaultHourlyRate: { type: Number, default: null },
    acceptsDirectRequests: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const MusicianProfile = model<IMusicianProfile>(
  "MusicianProfile",
  MusicianProfileSchema,
);
