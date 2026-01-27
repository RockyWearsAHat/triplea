/**
 * Serverless entry point for Netlify Functions.
 * Wraps the Express app with serverless-http for AWS Lambda compatibility.
 */
import dotenv from "dotenv";
import path from "node:path";

// Load .env from root directory
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import serverless from "serverless-http";
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

// Determine allowed origins based on environment
const getAllowedOrigins = (): string[] => {
  const netlifyUrl = process.env.URL || process.env.DEPLOY_PRIME_URL;

  if (netlifyUrl) {
    // Extract base domain from Netlify URL
    const url = new URL(netlifyUrl);
    const baseDomain = url.hostname.replace(/^(muse\.|music\.|musician\.)/, "");
    return [
      `https://muse.${baseDomain}`,
      `https://music.${baseDomain}`,
      `https://musician.${baseDomain}`,
      `https://${baseDomain}`,
      netlifyUrl,
    ];
  }

  // Local development
  return [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
  ];
};

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = getAllowedOrigins();
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        // In production, be more permissive for Netlify deploy previews
        if (process.env.NETLIFY && origin?.includes("netlify")) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      }
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());
app.use(attachUser);

// Mount routes - note: serverless-http handles the base path
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

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", env: process.env.NETLIFY ? "netlify" : "local" });
});

// MongoDB connection (reuse across invocations)
let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;

  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is not set in environment");
  }

  try {
    await mongoose.connect(MONGO_URI);
    isConnected = true;
    console.log("Connected to MongoDB");

    // Seed demo data if enabled (only once)
    await seedDemoDataIfEnabled();
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
    throw err;
  }
};

// Wrap with serverless-http
// Netlify redirects /api/* to this function, stripping the /api prefix
// We need to add it back for Express routing to work correctly
const serverlessHandler = serverless(app, {
  request: (request: any) => {
    // On Netlify, the path comes in without /api prefix (e.g., /auth/login)
    // Add /api prefix so Express routes match correctly
    if (process.env.NETLIFY && !request.path.startsWith("/api")) {
      request.url = `/api${request.url}`;
      request.path = `/api${request.path}`;
    }
  },
});

// Export handler for Netlify Functions
export const handler = async (event: any, context: any) => {
  // Keep the connection alive between invocations
  context.callbackWaitsForEmptyEventLoop = false;

  // On Netlify, add /api prefix to the path if not present
  if (process.env.NETLIFY && event.path && !event.path.startsWith("/api")) {
    event.path = `/api${event.path}`;
  }

  await connectDB();
  return serverlessHandler(event, context);
};

export default app;
