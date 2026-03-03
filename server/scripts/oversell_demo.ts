/**
 * Demo script to simulate concurrent seat claims against the TicketSeat unique index.
 *
 * Usage:
 *   MONGO_URI="mongodb://localhost:27017/triplea-dev" ts-node ./server/scripts/oversell_demo.ts
 *
 * This script is for local verification only and is not run by CI here.
 */
import mongoose from "mongoose";
import { TicketSeat } from "../src/models/TicketSeat";

async function main() {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/triplea-dev";
  await mongoose.connect(uri);

  const gigId = new mongoose.Types.ObjectId();
  const seatId = "seat-A1";

  // Clean up any previous doc
  await TicketSeat.deleteMany({ gigId, seatId }).exec();

  const attempts = Array.from({ length: 5 }).map((_, i) => async () => {
    try {
      const doc = await TicketSeat.create({
        gigId,
        ticketId: new mongoose.Types.ObjectId(),
        layoutId: new mongoose.Types.ObjectId(),
        seatId,
        section: "Orchestra",
        row: "A",
        seatNumber: "1",
        status: "valid",
      });
      return { ok: true, id: doc._id.toString(), err: null };
    } catch (err: any) {
      return { ok: false, id: null, err: err.message || String(err) };
    }
  });

  // Run concurrently
  const results = await Promise.all(attempts.map((fn) => fn()));
  console.log("Results:", results);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
