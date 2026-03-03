/**
 * Demo script to simulate concurrent ticket-tier purchases and verify that
 * capacity-guarded atomic increments prevent overselling.
 *
 * Usage:
 *   MONGO_URI="mongodb://localhost:27017/triplea-dev" ts-node ./server/scripts/oversell_tier_demo.ts
 *
 * This script is for local verification only and is not run by CI here.
 */

import mongoose from "mongoose";
import { TicketTier } from "../src/models/TicketTier";

async function main() {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/triplea-dev";
  await mongoose.connect(uri);

  const gigId = new mongoose.Types.ObjectId();
  const qty = 1;

  await TicketTier.deleteMany({ gigId }).exec();

  const tier = await TicketTier.create({
    gigId,
    name: "Demo Tier",
    tierType: "general_admission",
    price: 10,
    capacity: 2,
    sold: 0,
    available: true,
    sortOrder: 0,
  });

  const attempts = Array.from({ length: 5 }).map((_, i) => async () => {
    try {
      const updated = await TicketTier.findOneAndUpdate(
        {
          _id: tier._id,
          $expr: {
            $lte: ["$sold", { $subtract: ["$capacity", qty] }],
          },
        },
        { $inc: { sold: qty } },
        { new: true },
      ).exec();

      return {
        attempt: i + 1,
        ok: !!updated,
        sold: updated?.sold ?? null,
      };
    } catch (err: any) {
      return {
        attempt: i + 1,
        ok: false,
        sold: null,
        err: err?.message || String(err),
      };
    }
  });

  const results = await Promise.all(attempts.map((fn) => fn()));
  const successCount = results.filter((r) => r.ok).length;
  const finalTier = await TicketTier.findById(tier._id).exec();

  console.log({ results, successCount, finalSold: finalTier?.sold });

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
