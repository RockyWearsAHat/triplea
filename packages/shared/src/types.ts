// Core shared domain types

export type UserRole =
  | "musician"
  | "customer"
  | "teacher"
  | "rental_provider" // internal ops / employee
  | "admin";

export type Permission =
  | "view_admin_dashboard"
  | "manage_employees"
  | "view_musician_dashboard"
  | "view_customer_dashboard"
  | "view_employee_dashboard"
  | "manage_gear_requests"
  | "manage_venue_ads";

export type EmployeeRole =
  | "operations_manager"
  | "gear_tech"
  | "driver"
  | "warehouse";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole[];
  permissions?: Permission[];
  employeeRoles?: EmployeeRole[];
  stripeAccountId?: string | null;
  stripeChargesEnabled?: boolean;
  stripePayoutsEnabled?: boolean;
  stripeOnboardingComplete?: boolean;
}

export interface StripeOnboardingStatus {
  stripeAccountId?: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirements?: string[];
}

export interface ChatConversation {
  id: string;
  title: string | null;
  participantIds: string[];
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export type ColorRating =
  | "gold"
  | "light-gold"
  | "blue"
  | "light-blue"
  | "purple"
  | "light-purple";

export interface MusicianProfile {
  id: string;
  userId: string;
  instruments: string[];
  genres: string[];
  bio?: string;
  averageRating: number;
  reviewCount: number;
  // Dual rating system (Discord 2/8/26)
  colorRating?: ColorRating;
  // Typical time needed to learn/memorize a piece (in days)
  learnSpeed?: number;
  // Optional skill indicator (1-10)
  skillLevel?: number;
  // Marketplace settings for direct artist requests
  defaultHourlyRate?: number; // suggested hourly rate for direct bookings
  acceptsDirectRequests?: boolean; // whether hosts can request this artist directly
}

export type BookingStatus =
  | "requested"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface Event {
  id: string;
  title: string;
  date: string; // ISO
  time: string; // HH:MM
  venue: string;
  budget?: number;
}

export interface Booking {
  id: string;
  eventId: string;
  musicianId: string;
  payout: number;
  status: BookingStatus;
}

export interface Instrument {
  id: string;
  name: string;
  category: string;
  dailyRate: number;
  available: boolean;
  imageCount?: number;
  imageUrl?: string;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  imageCount?: number;
  imageUrl?: string;
  coordinates?: { lat: number; lng: number };
  /** Maximum seat capacity set by the venue */
  seatCapacity?: number;
}

export type GigStatus = "open" | "cancelled" | "filled";
export type GigType = "musician-wanted" | "public-concert";
export type SeatingType = "general_admission" | "reserved" | "mixed";

export interface Gig {
  id: string;
  title: string;
  description?: string;
  date: string;
  time?: string;
  budget?: number;
  status: GigStatus;
  gigType?: GigType;
  /** For public concerts: is ticket selling enabled? */
  openForTickets?: boolean;
  /** For public concerts: ticket price in dollars */
  ticketPrice?: number;
  location?: Location | null;
  /** Type of seating arrangement */
  seatingType?: SeatingType;
  /** Seat capacity for this event */
  seatCapacity?: number;
  /** Whether the concert has multiple ticket tiers */
  hasTicketTiers?: boolean;
  /** Available ticket tiers for this event */
  ticketTiers?: TicketTier[];
  /** Seating layout ID for reserved seating */
  seatingLayoutId?: string;
}

export type GigApplicationStatus = "pending" | "accepted" | "denied";

export interface GigApplicantSummary {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

export interface GigApplication {
  id: string;
  gigId: string;
  status: GigApplicationStatus;
  message?: string | null;
  createdAt?: string;
  decidedAt?: string | null;
  applicant?: GigApplicantSummary;
}

export type ArtistRequestStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled";

export interface ArtistRequest {
  id: string;
  gigId: string;
  musicianUserId: string;
  priceOffered: number;
  status: ArtistRequestStatus;
  message?: string | null;
  createdAt?: string;
  decidedAt?: string | null;
}

export interface Perk {
  id: string;
  name: string;
  description: string;
  minRating?: number;
  minCompletedBookings?: number;
}

// Geolocation for marketplace
export interface GeoCoordinates {
  lat: number;
  lng: number;
}

export interface GigWithDistance extends Gig {
  distanceMiles?: number;
  coordinates?: GeoCoordinates;
}

export interface ConcertSearchParams {
  lat?: number;
  lng?: number;
  radiusMiles?: number;
  genres?: string[];
  dateFrom?: string;
  dateTo?: string;
}

// Ticket types
export type TicketStatus = "valid" | "used" | "cancelled" | "expired";

export interface Ticket {
  id: string;
  confirmationCode: string;
  gigId?: string;
  quantity: number;
  pricePerTicket: number;
  totalPaid: number;
  status: TicketStatus;
  holderName: string;
  email?: string;
  usedAt?: string | null;
  createdAt: string;
  gig?: {
    id: string;
    title: string;
    date: string;
    time?: string;
  } | null;
  location?: {
    id: string;
    name: string;
    city?: string;
    address?: string;
  } | null;
}

export interface TicketPurchaseResult {
  ticket: Ticket;
}

export interface TicketQrResult {
  qrPayload: string;
  expiresAt: string;
  status: TicketStatus;
}

export interface TicketScanResult {
  valid: boolean;
  message?: string;
  ticket?: {
    id: string;
    confirmationCode: string;
    quantity: number;
    holderName: string;
    status: TicketStatus;
  };
  gig?: {
    id: string;
    title: string;
    date: string;
    time?: string;
  } | null;
}

// Stripe / Payment types
export interface FeeBreakdown {
  subtotal: number;
  serviceFee: number;
  stripeFee: number;
  total: number;
  /** Display string for service fee (e.g., "1%" or "$1") */
  serviceFeeDisplay?: string;
  /** Fee charge mode: "transaction" (once) or "ticket" (per ticket) */
  feeChargeMode?: "transaction" | "ticket";
  /** Estimated tax based on event location (may be 0 if unavailable) */
  tax?: number;
  /** Total including estimated tax */
  totalWithTax?: number;
}

export interface CheckoutSession {
  clientSecret: string;
  paymentIntentId: string;
  fees: FeeBreakdown;
  gig: {
    id: string;
    title: string;
    date: string;
    time?: string;
  };
  location?: {
    id: string;
    name: string;
  } | null;
}

export interface CheckoutRequest {
  gigId: string;
  quantity: number;
  email: string;
  holderName: string;
  /** Ticket tier ID if purchasing tiered tickets */
  tierId?: string;
  /** Selected seat IDs for reserved seating */
  seatIds?: string[];
}

export interface FeeCalculationResult extends FeeBreakdown {
  isFree: boolean;
}

// Ticket Tier types
export type TicketTierType =
  | "general_admission"
  | "reserved"
  | "vip"
  | "premium";

export interface TicketTier {
  id: string;
  gigId: string;
  name: string;
  description?: string;
  tierType: TicketTierType;
  price: number;
  capacity: number;
  sold: number;
  available: boolean;
  sortOrder: number;
  color?: string;
  /** Calculated remaining tickets */
  remaining?: number;
}

// Seating Layout types
export interface Seat {
  seatId: string;
  row: string;
  seatNumber: string;
  section: string;
  tierId?: string;
  posX?: number;
  posY?: number;
  isAvailable: boolean;
  accessibility?: string[];
  /** Whether this specific seat is already sold */
  isSold?: boolean;
}

export interface SeatingSection {
  sectionId: string;
  name: string;
  color?: string;
  defaultTierId?: string;
  rows: string[];
  seatsPerRow: number[];
}

export interface SeatingLayout {
  id: string;
  name: string;
  locationId: string;
  description?: string;
  totalCapacity: number;
  sections: SeatingSection[];
  seats: Seat[];
  stagePosition?: "top" | "bottom" | "left" | "right";
}

export interface SeatAssignment {
  seatId: string;
  section: string;
  row: string;
  seatNumber: string;
}

// Extended ticket type with seat assignments
export interface TicketWithSeats extends Ticket {
  tierId?: string;
  tierName?: string;
  seatAssignments?: SeatAssignment[];
}

// Available seats response
export interface AvailableSeatsResponse {
  layout: SeatingLayout;
  soldSeatIds: string[];
  tiers: TicketTier[];
}

// ===== Staff Management Types =====

export type StaffPermission =
  | "scan_tickets"
  | "view_sales"
  | "manage_events"
  | "manage_venues"
  | "send_messages";

export type StaffInviteStatus = "pending" | "accepted" | "revoked" | "expired";

export interface StaffMember {
  id: string;
  email: string;
  staffName: string | null;
  permissions: StaffPermission[];
  status: StaffInviteStatus;
  userId: string | null;
  acceptedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface StaffHost {
  id: string;
  hostId: string;
  hostName: string;
  hostEmail?: string;
  permissions: StaffPermission[];
  acceptedAt?: string;
}

// ===== Extended Gig Type with Stats =====

export interface GigWithStats extends Gig {
  ticketsSold?: number;
  ticketRevenue?: number;
  applicantCount?: number;
}
