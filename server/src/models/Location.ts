import { Schema, model, type Document } from "mongoose";

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
}

const StoredImageSchema = new Schema<IStoredImage>(
  {
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    data: { type: Buffer, required: true },
  },
  { _id: false }
);

const LocationSchema = new Schema<ILocation>(
  {
    name: { type: String, required: true },
    address: { type: String },
    city: { type: String },
    images: { type: [StoredImageSchema], default: [] },
  },
  { timestamps: true }
);

export const Location = model<ILocation>("Location", LocationSchema);
