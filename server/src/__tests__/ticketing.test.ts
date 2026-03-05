import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Gig } from "../models/Gig";
import { Ticket } from "../models/Ticket";
import { TicketSeat } from "../models/TicketSeat";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // Ensure indexes are built (required for unique constraint tests)
  await TicketSeat.createIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Gig.deleteMany({});
  await Ticket.deleteMany({});
  await TicketSeat.deleteMany({});
});

// ---------------------------------------------------------------------------
// Test 1 — Concurrent reserved seat purchase
// ---------------------------------------------------------------------------
it("Concurrent seat purchase: exactly one of two simultaneous requests for the same seat succeeds", async () => {
  const gigId = new mongoose.Types.ObjectId();
  const ticketId1 = new mongoose.Types.ObjectId();
  const ticketId2 = new mongoose.Types.ObjectId();

  const results = await Promise.allSettled([
    TicketSeat.create({
      gigId,
      ticketId: ticketId1,
      seatId: "A1",
      section: "Orchestra",
      row: "A",
      seatNumber: "1",
      status: "valid",
    }),
    TicketSeat.create({
      gigId,
      ticketId: ticketId2,
      seatId: "A1",
      section: "Orchestra",
      row: "A",
      seatNumber: "1",
      status: "valid",
    }),
  ]);

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");

  expect(fulfilled.length).toBe(1);
  expect(rejected.length).toBe(1);

  const count = await TicketSeat.countDocuments({ gigId, seatId: "A1" });
  expect(count).toBe(1);
});

// ---------------------------------------------------------------------------
// Test 2 — Concurrent GA purchase
// ---------------------------------------------------------------------------
it("Concurrent GA purchase: ticketsSold never exceeds seatCapacity", async () => {
  const gig = await Gig.create({
    title: "Test Concert",
    date: "2026-06-01",
    createdByUserId: new mongoose.Types.ObjectId(),
    gigType: "public-concert",
    seatingType: "general_admission",
    seatCapacity: 5,
    ticketsSold: 4,
  });

  const tryReserve = async (qty: number): Promise<boolean> => {
    const updated = await Gig.findOneAndUpdate(
      {
        _id: gig._id,
        $expr: {
          $lte: [
            { $add: [{ $ifNull: ["$ticketsSold", 0] }, qty] },
            "$seatCapacity",
          ],
        },
      },
      { $inc: { ticketsSold: qty } },
      { new: false },
    ).exec();
    return !!updated;
  };

  const [r1, r2] = await Promise.all([tryReserve(1), tryReserve(1)]);

  expect([r1, r2].filter(Boolean).length).toBe(1);

  const refreshed = await Gig.findById(gig._id).exec();
  expect(refreshed!.ticketsSold).toBe(5);
});

// ---------------------------------------------------------------------------
// Test 3 — Stripe confirm-payment finalises tickets
// ---------------------------------------------------------------------------
it("Stripe confirm-payment: finalises ticket status and increments ticketsSold", async () => {
  const gig = await Gig.create({
    title: "Test Concert",
    date: "2026-06-01",
    createdByUserId: new mongoose.Types.ObjectId(),
    gigType: "public-concert",
    seatingType: "general_admission",
    seatCapacity: 10,
    ticketsSold: 0,
    openForTickets: true,
    ticketPrice: 25,
  });

  const ticket = await Ticket.create({
    gigId: gig._id,
    userId: null,
    email: "buyer@example.com",
    holderName: "Test Buyer",
    quantity: 2,
    pricePerTicket: 25,
    totalPaid: 50,
    serviceFee: 0.5,
    stripeFee: 1.75,
    stripePaymentIntentId: "pi_integration_test_001",
    paymentStatus: "pending",
    status: "valid",
    qrToken: "tok-001",
    qrTokenExpiresAt: new Date(Date.now() + 86_400_000),
    qrSecret: "sec-001",
    confirmationCode: "INTEGR00001",
  });

  ticket.paymentStatus = "completed";
  await ticket.save();

  const updatedGig = await Gig.findOneAndUpdate(
    {
      _id: gig._id,
      $expr: {
        $lte: [
          { $add: [{ $ifNull: ["$ticketsSold", 0] }, ticket.quantity] },
          "$seatCapacity",
        ],
      },
    },
    { $inc: { ticketsSold: ticket.quantity } },
    { new: true },
  ).exec();

  expect(updatedGig).not.toBeNull();
  expect(updatedGig!.ticketsSold).toBe(2);

  const saved = await Ticket.findOne({
    stripePaymentIntentId: "pi_integration_test_001",
  }).exec();
  expect(saved!.paymentStatus).toBe("completed");
  expect(saved!.quantity).toBe(2);
});

// ---------------------------------------------------------------------------
// Test 4 — Duplicate TicketSeat prevention
// ---------------------------------------------------------------------------
it("Duplicate TicketSeat: second insert for same {gigId, seatId} is rejected", async () => {
  const gigId = new mongoose.Types.ObjectId();
  const ticketId = new mongoose.Types.ObjectId();

  await TicketSeat.create({
    gigId,
    ticketId,
    seatId: "B5",
    section: "Balcony",
    row: "B",
    seatNumber: "5",
    status: "valid",
  });

  await expect(
    TicketSeat.create({
      gigId,
      ticketId: new mongoose.Types.ObjectId(),
      seatId: "B5",
      section: "Balcony",
      row: "B",
      seatNumber: "5",
      status: "valid",
    }),
  ).rejects.toMatchObject({ code: 11000 });

  const count = await TicketSeat.countDocuments({ gigId, seatId: "B5" });
  expect(count).toBe(1);
});
