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

export interface MusicianProfile {
  id: string;
  userId: string;
  instruments: string[];
  genres: string[];
  bio?: string;
  averageRating: number;
  reviewCount: number;
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
}

export type GigStatus = "open" | "cancelled" | "filled";

export interface Gig {
  id: string;
  title: string;
  description?: string;
  date: string;
  time?: string;
  budget?: number;
  status: GigStatus;
  location?: Location | null;
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
