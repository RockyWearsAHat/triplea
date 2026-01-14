import { Schema, model, type Document, Types } from "mongoose";

export type GigApplicationStatus = "pending" | "accepted" | "denied";

export interface IGigApplication extends Document {
  gigId: Types.ObjectId;
  applicantUserId: Types.ObjectId;
  message?: string;
  status: GigApplicationStatus;
  decidedAt?: Date;
  decidedByUserId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const GigApplicationSchema = new Schema<IGigApplication>(
  {
    gigId: {
      type: Schema.Types.ObjectId,
      ref: "Gig",
      required: true,
      index: true,
    },
    applicantUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    message: { type: String },
    status: {
      type: String,
      enum: ["pending", "accepted", "denied"],
      default: "pending",
      index: true,
    },
    decidedAt: { type: Date },
    decidedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

GigApplicationSchema.index({ gigId: 1, applicantUserId: 1 }, { unique: true });

export const GigApplication = model<IGigApplication>(
  "GigApplication",
  GigApplicationSchema
);
