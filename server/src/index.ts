import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import authRoutes from "./routes/auth";

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

app.use("/api/auth", authRoutes);

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
