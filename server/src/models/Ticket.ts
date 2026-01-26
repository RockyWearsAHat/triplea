import { Schema, model, type Document, Types } from "mongoose";
import crypto from "crypto";

export type TicketStatus = "valid" | "used" | "cancelled" | "expired";

/**
 * Individual seat assignment for a ticket
 */
export interface ISeatAssignment {
  /** Seat ID from the seating layout */
  seatId: string;
  /** Section name */
  section: string;
  /** Row identifier */
  row: string;
  /** Seat number */
  seatNumber: string;
}

export interface ITicket extends Document {
  /** The gig/concert this ticket is for */
  gigId: Types.ObjectId;
  /** User who purchased/owns the ticket (null for guest purchases) */
  userId: Types.ObjectId | null;
  /** Email associated with the ticket (for confirmation + guest purchases) */
  email: string;
  /** Name on the ticket */
  holderName: string;
  /** Quantity of tickets in this order */
  quantity: number;
  /** Price paid per ticket */
  pricePerTicket: number;
  /** Total amount paid */
  totalPaid: number;
  /** 1% platform service fee */
  serviceFee: number;
  /** Stripe processing fee */
  stripeFee: number;
  /** Stripe Payment Intent ID */
  stripePaymentIntentId: string | null;
  /** Payment status */
  paymentStatus: "pending" | "completed" | "failed" | "refunded";
  /** Ticket status */
  status: TicketStatus;
  /** Current QR code token - rotates periodically for security */
  qrToken: string;
  /** When the current QR token expires and needs rotation */
  qrTokenExpiresAt: Date;
  /** Secret used to verify QR token authenticity */
  qrSecret: string;
  /** Timestamp when ticket was scanned/used (null if unused) */
  usedAt: Date | null;
  /** ID of user who scanned the ticket (host/employee) */
  scannedByUserId: Types.ObjectId | null;
  /** Order/confirmation reference number */
  confirmationCode: string;
  /** Ticket tier ID (for tiered pricing) */
  tierId?: Types.ObjectId | null;
  /** Tier name at time of purchase (for historical record) */
  tierName?: string;
  /** Assigned seats for reserved seating (one per ticket quantity) */
  seatAssignments?: ISeatAssignment[];
  createdAt: Date;
  updatedAt: Date;
}

// Generate a random confirmation code like "TAM-ABC123"
function generateConfirmationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TAM-${code}`;
}

// Generate a secure random token for QR codes
function generateQrToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Generate a secret for HMAC verification
function generateQrSecret(): string {
  return crypto.randomBytes(16).toString("hex");
}

const TicketSchema = new Schema<ITicket>(
  {
    gigId: {
      type: Schema.Types.ObjectId,
      ref: "Gig",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    email: { type: String, required: true, index: true },
    holderName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    pricePerTicket: { type: Number, required: true, min: 0 },
    totalPaid: { type: Number, required: true, min: 0 },
    serviceFee: { type: Number, default: 0, min: 0 },
    stripeFee: { type: Number, default: 0, min: 0 },
    stripePaymentIntentId: { type: String, default: null, index: true },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "completed",
    },
    status: {
      type: String,
      enum: ["valid", "used", "cancelled", "expired"],
      default: "valid",
      index: true,
    },
    qrToken: { type: String, required: true, unique: true, index: true },
    qrTokenExpiresAt: { type: Date, required: true },
    qrSecret: { type: String, required: true },
    usedAt: { type: Date, default: null },
    scannedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    confirmationCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tierId: {
      type: Schema.Types.ObjectId,
      ref: "TicketTier",
      default: null,
    },
    tierName: { type: String },
    seatAssignments: [
      {
        seatId: { type: String, required: true },
        section: { type: String, required: true },
        row: { type: String, required: true },
        seatNumber: { type: String, required: true },
      },
    ],
  },
  { timestamps: true },
);

// Methods for the Ticket model
TicketSchema.methods.rotateQrToken = function (): void {
  this.qrToken = generateQrToken();
  // QR token expires in 30 seconds for security
  this.qrTokenExpiresAt = new Date(Date.now() + 30 * 1000);
};

TicketSchema.methods.generateQrPayload = function (): string {
  // Create a signed payload with ticket info
  const payload = {
    ticketId: this._id.toString(),
    token: this.qrToken,
    exp: this.qrTokenExpiresAt.getTime(),
  };

  // Create HMAC signature for verification
  const hmac = crypto.createHmac("sha256", this.qrSecret);
  hmac.update(JSON.stringify(payload));
  const signature = hmac.digest("hex").slice(0, 16);

  return JSON.stringify({ ...payload, sig: signature });
};

// Static methods
TicketSchema.statics.createTicket = async function (params: {
  gigId: Types.ObjectId;
  userId: Types.ObjectId | null;
  email: string;
  holderName: string;
  quantity: number;
  pricePerTicket: number;
}) {
  const qrToken = generateQrToken();
  const qrSecret = generateQrSecret();
  const confirmationCode = generateConfirmationCode();

  const ticket = new this({
    gigId: params.gigId,
    userId: params.userId,
    email: params.email,
    holderName: params.holderName,
    quantity: params.quantity,
    pricePerTicket: params.pricePerTicket,
    totalPaid: params.pricePerTicket * params.quantity,
    serviceFee: 0,
    stripeFee: 0,
    stripePaymentIntentId: null,
    paymentStatus: "completed",
    status: "valid",
    qrToken,
    qrTokenExpiresAt: new Date(Date.now() + 30 * 1000),
    qrSecret,
    confirmationCode,
  });

  return ticket.save();
};

// Static method for creating tickets with Stripe payment
TicketSchema.statics.createTicketWithPayment = async function (params: {
  gigId: Types.ObjectId;
  userId: Types.ObjectId | null;
  email: string;
  holderName: string;
  quantity: number;
  pricePerTicket: number;
  totalPaid: number;
  serviceFee: number;
  stripeFee: number;
  stripePaymentIntentId: string;
}) {
  const qrToken = generateQrToken();
  const qrSecret = generateQrSecret();
  const confirmationCode = generateConfirmationCode();

  const ticket = new this({
    gigId: params.gigId,
    userId: params.userId,
    email: params.email,
    holderName: params.holderName,
    quantity: params.quantity,
    pricePerTicket: params.pricePerTicket,
    totalPaid: params.totalPaid,
    serviceFee: params.serviceFee,
    stripeFee: params.stripeFee,
    stripePaymentIntentId: params.stripePaymentIntentId,
    paymentStatus: "completed",
    status: "valid",
    qrToken,
    qrTokenExpiresAt: new Date(Date.now() + 30 * 1000),
    qrSecret,
    confirmationCode,
  });

  return ticket.save();
};

// Verify a QR payload and return the ticket if valid
TicketSchema.statics.verifyQrPayload = async function (
  payloadString: string,
): Promise<{
  valid: boolean;
  ticket?: ITicket;
  error?: string;
}> {
  try {
    const payload = JSON.parse(payloadString);
    const { ticketId, token, exp, sig } = payload;

    if (!ticketId || !token || !exp || !sig) {
      return { valid: false, error: "Invalid QR code format" };
    }

    const ticket = await this.findById(ticketId);
    if (!ticket) {
      return { valid: false, error: "Ticket not found" };
    }

    // Verify signature
    const verifyPayload = { ticketId, token, exp };
    const hmac = crypto.createHmac("sha256", ticket.qrSecret);
    hmac.update(JSON.stringify(verifyPayload));
    const expectedSig = hmac.digest("hex").slice(0, 16);

    if (sig !== expectedSig) {
      return { valid: false, error: "Invalid QR code signature" };
    }

    // Check if token matches and hasn't expired
    if (token !== ticket.qrToken) {
      return {
        valid: false,
        error: "QR code has been refreshed. Please show the current code.",
      };
    }

    if (Date.now() > exp) {
      return {
        valid: false,
        error: "QR code has expired. Please refresh and try again.",
      };
    }

    // Check ticket status
    if (ticket.status === "used") {
      return { valid: false, error: "This ticket has already been used" };
    }

    if (ticket.status === "cancelled") {
      return { valid: false, error: "This ticket has been cancelled" };
    }

    if (ticket.status === "expired") {
      return { valid: false, error: "This ticket has expired" };
    }

    return { valid: true, ticket };
  } catch {
    return { valid: false, error: "Invalid QR code" };
  }
};

export const Ticket = model<ITicket>("Ticket", TicketSchema);
