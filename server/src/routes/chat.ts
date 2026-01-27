import type { Response, Router } from "express";
import express from "express";
import mongoose from "mongoose";
import { Conversation } from "../models/Conversation";
import { Message } from "../models/Message";
import { User } from "../models/User";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import {
  createConversationSchema,
  createMessageSchema,
  validateBody,
  formatZodErrors,
} from "../lib/validation";

const router: Router = express.Router();

function isParticipant(
  conversation: { participantIds: any[] },
  userId: string,
): boolean {
  return conversation.participantIds.some(
    (id) => String(id) === String(userId),
  );
}

router.post(
  "/support",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.authUser!.id;

    const admin = await User.findOne({ roles: "admin" })
      .sort({ createdAt: 1 })
      .exec();

    if (!admin) {
      return res
        .status(404)
        .json({ message: "No admin available for support" });
    }

    const userObjId = new mongoose.Types.ObjectId(userId);
    const adminObjId = new mongoose.Types.ObjectId(admin.id);

    const existing = await Conversation.find({
      participantIds: { $all: [userObjId, adminObjId] },
    })
      .limit(20)
      .exec();

    const exact = existing.find((c) => c.participantIds.length === 2);
    const conversation =
      exact ??
      (await Conversation.create({
        participantIds: [userObjId, adminObjId],
        title: "Support",
      }));

    return res.json({
      id: conversation.id,
      title: conversation.title ?? null,
      participantIds: conversation.participantIds.map((p) => String(p)),
      updatedAt: conversation.updatedAt,
    });
  },
);

router.get(
  "/conversations",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.authUser!.id;

    const conversations = await Conversation.find({
      participantIds: new mongoose.Types.ObjectId(userId),
    })
      .sort({ updatedAt: -1 })
      .limit(100)
      .exec();

    return res.json({
      conversations: conversations.map((c) => ({
        id: c.id,
        title: c.title ?? null,
        participantIds: c.participantIds.map((p) => String(p)),
        updatedAt: c.updatedAt,
      })),
    });
  },
);

router.post(
  "/conversations",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.authUser!.id;

    // Validate input
    const validation = validateBody(createConversationSchema, req.body);
    if (!validation.success) {
      return res
        .status(400)
        .json({ message: formatZodErrors(validation.errors) });
    }

    const { participantIds, title } = validation.data;

    // Verify all participants exist before creating conversation
    const validUsers = await User.find({ _id: { $in: participantIds } })
      .select("_id")
      .exec();

    if (validUsers.length !== participantIds.length) {
      return res
        .status(400)
        .json({ message: "One or more participant IDs are invalid" });
    }

    const uniq = Array.from(new Set([userId, ...participantIds]));

    const conversation = await Conversation.create({
      participantIds: uniq.map((id) => new mongoose.Types.ObjectId(id)),
      title,
    });

    return res.status(201).json({
      id: conversation.id,
      title: conversation.title ?? null,
      participantIds: conversation.participantIds.map((p) => String(p)),
      updatedAt: conversation.updatedAt,
    });
  },
);

router.get(
  "/conversations/:id/messages",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.authUser!.id;
    const { id } = req.params as { id: string };

    const conversation = await Conversation.findById(id).exec();
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (
      !isParticipant(conversation, userId) &&
      !req.authUser!.roles.includes("admin")
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const messages = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .limit(500)
      .exec();

    return res.json({
      messages: messages.map((m) => ({
        id: m.id,
        conversationId: String(m.conversationId),
        senderId: String(m.senderId),
        body: m.body,
        createdAt: m.createdAt,
      })),
    });
  },
);

router.post(
  "/conversations/:id/messages",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.authUser!.id;
    const { id } = req.params as { id: string };

    // Validate message body
    const validation = validateBody(createMessageSchema, req.body);
    if (!validation.success) {
      return res
        .status(400)
        .json({ message: formatZodErrors(validation.errors) });
    }

    const { body } = validation.data;

    const conversation = await Conversation.findById(id).exec();
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (
      !isParticipant(conversation, userId) &&
      !req.authUser!.roles.includes("admin")
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const msg = await Message.create({
      conversationId: conversation._id,
      senderId: new mongoose.Types.ObjectId(userId),
      body: body.trim(),
    });

    // touch updatedAt
    conversation.updatedAt = new Date();
    await conversation.save();

    return res.status(201).json({
      id: msg.id,
      conversationId: String(msg.conversationId),
      senderId: String(msg.senderId),
      body: msg.body,
      createdAt: msg.createdAt,
    });
  },
);

export default router;
