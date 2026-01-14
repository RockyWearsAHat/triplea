import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import authRoutes from "./routes/auth";
import adminRoutes from "./routes/admin";
import chatRoutes from "./routes/chat";
import ownerRoutes from "./routes/owner";
import publicRoutes from "./routes/public";
import gigsRoutes from "./routes/gigs";
import { attachUser } from "./middleware/auth";
import { seedDemoDataIfEnabled } from "./lib/seedDemo";

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(attachUser);

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/owner", ownerRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/gigs", gigsRoutes);

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const MONGO_URI = process.env.MONGO_URI ?? "";

async function start() {
  if (!MONGO_URI) {
    // eslint-disable-next-line no-console
    console.error("MONGO_URI is not set in environment");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    // eslint-disable-next-line no-console
    console.log("Connected to MongoDB");

    await seedDemoDataIfEnabled();

    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`API server listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to start server", err);
    process.exit(1);
  }
}

start();
