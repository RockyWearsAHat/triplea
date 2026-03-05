/**
 * One-time migration: backfill TicketSeat documents from existing Ticket
 * records and recompute Gig.ticketsSold for all affected gigs.
 *
 * Idempotent — safe to run multiple times.
 *
 * Usage:
 *   MONGO_URI="mongodb://localhost:27017/triplea-dev" \
 *     SEED_DEMO_DATA=true ts-node ./server/scripts/backfill-ticket-seats.ts
 */

import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import mongoose from "mongoose";
import { Ticket } from "../src/models/Ticket";
import { TicketSeat } from "../src/models/TicketSeat";
import { Gig } from "../src/models/Gig";

async function main(): Promise<void> {
  if (process.env.SEED_DEMO_DATA !== "true") {
    console.log(
      'SEED_DEMO_DATA is not "true" — skipping backfill. Set SEED_DEMO_DATA=true to run.',
    );
    process.exit(0);
  }

  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/triplea-dev";
  console.log(`Connecting to ${uri} ...`);
  await mongoose.connect(uri);
  console.log("Connected.\n");

  const tickets = await Ticket.find({
    status: { $in: ["valid", "used"] },
  }).exec();

  console.log(`Found ${tickets.length} valid/used tickets to inspect.`);

  let seatDocsCreated = 0;
  let seatDocsSkipped = 0;
  let seatDocsFailed = 0;

  for (const ticket of tickets) {
    if (!ticket.seatAssignments || ticket.seatAssignments.length === 0) {
      continue;
    }

    for (const sa of ticket.seatAssignments) {
      const exists = await TicketSeat.exists({
        gigId: ticket.gigId,
        seatId: sa.seatId,
      }).exec();

      if (exists) {
        seatDocsSkipped++;
        continue;
      }

      try {
        await TicketSeat.create({
          gigId: ticket.gigId,
          ticketId: ticket._id,
          seatId: sa.seatId,
          section: sa.section,
          row: sa.row,
          seatNumber: sa.seatNumber,
          status: ticket.status,
        });
        seatDocsCreated++;
      } catch (err: any) {
        if (err.code === 11000) {
          seatDocsSkipped++;
        } else {
          console.error(
            `Failed for gigId=${ticket.gigId} seatId=${sa.seatId}:`,
            err.message,
          );
          seatDocsFailed++;
        }
      }
    }
  }

  const gigIds = [...new Set(tickets.map((t) => String(t.gigId)))];
  console.log(`\nRecomputing ticketsSold for ${gigIds.length} gig(s) ...`);

  let gigsUpdated = 0;

  for (const gigIdStr of gigIds) {
    const gigObjectId = new mongoose.Types.ObjectId(gigIdStr);

    const reservedCount = await TicketSeat.countDocuments({
      gigId: gigObjectId,
    }).exec();

    const gaAgg = await Ticket.aggregate([
      {
        $match: {
          gigId: gigObjectId,
          status: { $in: ["valid", "used"] },
          $or: [
            { seatAssignments: { $exists: false } },
            { seatAssignments: { $size: 0 } },
          ],
        },
      },
      { $group: { _id: null, total: { $sum: "$quantity" } } },
    ]).exec();

    const gaSold: number = gaAgg[0]?.total ?? 0;
    const totalSold = reservedCount + gaSold;

    await Gig.updateOne(
      { _id: gigObjectId },
      { $set: { ticketsSold: totalSold } },
    ).exec();

    gigsUpdated++;
  }

  console.log("\n--------------------------------");
  console.log("Backfill complete:");
  console.log(`  TicketSeat docs created : ${seatDocsCreated}`);
  console.log(`  TicketSeat docs skipped : ${seatDocsSkipped}`);
  console.log(`  TicketSeat docs failed  : ${seatDocsFailed}`);
  console.log(`  Gigs updated            : ${gigsUpdated}`);
  console.log("--------------------------------\n");

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
