import { Schema, model, type Document, type Types } from "mongoose";

export interface IConversation extends Document {
  participantIds: Types.ObjectId[];
  title?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    participantIds: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      required: true,
      default: [],
    },
    title: { type: String },
  },
  { timestamps: true }
);

ConversationSchema.index({ participantIds: 1 });

export const Conversation = model<IConversation>(
  "Conversation",
  ConversationSchema
);
