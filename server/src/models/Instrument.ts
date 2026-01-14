import { Schema, model, type Document } from "mongoose";

export interface IStoredImage {
  filename: string;
  mimeType: string;
  data: Buffer;
}

export interface IInstrument extends Document {
  name: string;
  category: string;
  dailyRate: number;
  available: boolean;
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

const InstrumentSchema = new Schema<IInstrument>(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
    dailyRate: { type: Number, required: true },
    available: { type: Boolean, required: true, default: true },
    images: { type: [StoredImageSchema], default: [] },
  },
  { timestamps: true }
);

export const Instrument = model<IInstrument>("Instrument", InstrumentSchema);
