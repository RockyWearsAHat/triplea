import { Schema, model, type Document, Types } from "mongoose";

export type RehearsalStatus =
  | "pending"
  | "scheduled"
  | "completed"
  | "cancelled";

export type RehearsalParticipantStatus =
  | "invited"
  | "accepted"
  | "declined"
  | "selected"
  | "rejected";

export interface IRehearsalParticipant {
  musicianId: Types.ObjectId;
  status: RehearsalParticipantStatus;
  /** Musician's share if selected (percentage, 0-100) */
  payoutPercentage?: number;
}

export interface IRehearsal extends Document {
  /** Reference to the gig/event this rehearsal is for */
  gigId: Types.ObjectId;
  /** Host who created this rehearsal session */
  createdByUserId: Types.ObjectId;
  /** Date of rehearsal */
  date: string; // ISO yyyy-mm-dd
  /** Time of rehearsal */
  time?: string; // HH:MM
  /** Duration in hours */
  duration?: number;
  /** Total deposit/budget for this rehearsal */
  deposit: number;
  /** Musicians invited to this tryout */
  participants: IRehearsalParticipant[];
  status: RehearsalStatus;
  /** Notes from host about what to prepare */
  notes?: string;
  /** Location for rehearsal */
  locationId?: Types.ObjectId;
}

const RehearsalParticipantSchema = new Schema<IRehearsalParticipant>(
  {
    musicianId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["invited", "accepted", "declined", "selected", "rejected"],
      default: "invited",
    },
    payoutPercentage: { type: Number, min: 0, max: 100 },
  },
  { _id: false },
);

const RehearsalSchema = new Schema<IRehearsal>(
  {
    gigId: {
      type: Schema.Types.ObjectId,
      ref: "Gig",
      required: true,
      index: true,
    },
    createdByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: { type: String, required: true },
    time: { type: String },
    duration: { type: Number, min: 0.5, max: 12 },
    deposit: { type: Number, required: true, min: 0 },
    participants: { type: [RehearsalParticipantSchema], default: [] },
    status: {
      type: String,
      enum: ["pending", "scheduled", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
    notes: { type: String },
    locationId: { type: Schema.Types.ObjectId, ref: "Location" },
  },
  { timestamps: true },
);

RehearsalSchema.index({ gigId: 1, status: 1 });
RehearsalSchema.index({ "participants.musicianId": 1, status: 1 });

export const Rehearsal = model<IRehearsal>("Rehearsal", RehearsalSchema);
