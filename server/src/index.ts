import dotenv from "dotenv";
import path from "node:path";

// Load .env from root directory
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

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
import musiciansRoutes from "./routes/musicians";
import locationsRoutes from "./routes/locations";
import artistRequestsRoutes from "./routes/artistRequests";
import instrumentsRoutes from "./routes/instruments";
import ticketsRoutes from "./routes/tickets";
import stripeRoutes from "./routes/stripe";
import seatingRoutes from "./routes/seating";
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
  }),
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
app.use("/api/musicians", musiciansRoutes);
app.use("/api/locations", locationsRoutes);
app.use("/api/artist-requests", artistRequestsRoutes);
app.use("/api/instruments", instrumentsRoutes);
app.use("/api/tickets", ticketsRoutes);
app.use("/api/stripe", stripeRoutes);
app.use("/api/seating", seatingRoutes);

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
