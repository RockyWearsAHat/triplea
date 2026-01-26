import { Schema, model, type Document, Types } from "mongoose";

export interface IStoredImage {
  filename: string;
  mimeType: string;
  data: Buffer;
}

export interface ILocation extends Document {
  name: string;
  address?: string;
  city?: string;
  images: IStoredImage[];
  createdByUserId?: Types.ObjectId;
  coordinates?: { lat: number; lng: number };
  /** Maximum seat capacity set by the venue */
  seatCapacity?: number;
}

const StoredImageSchema = new Schema<IStoredImage>(
  {
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    data: { type: Buffer, required: true },
  },
  { _id: false },
);

const LocationSchema = new Schema<ILocation>(
  {
    name: { type: String, required: true },
    address: { type: String },
    city: { type: String },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User" },
    images: { type: [StoredImageSchema], default: [] },
    coordinates: {
      type: { lat: { type: Number }, lng: { type: Number } },
      default: undefined,
    },
    seatCapacity: { type: Number, min: 0 },
  },
  { timestamps: true },
);

export const Location = model<ILocation>("Location", LocationSchema);
