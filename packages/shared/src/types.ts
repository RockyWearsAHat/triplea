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

export interface MusicianProfile {
  id: string;
  userId: string;
  instruments: string[];
  genres: string[];
  bio?: string;
  averageRating: number;
  reviewCount: number;
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
}

export interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
}

export interface Perk {
  id: string;
  name: string;
  description: string;
  minRating?: number;
  minCompletedBookings?: number;
}
