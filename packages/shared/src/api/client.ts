// Shared API client shapes for Triple A apps.
// These are intentionally minimal and currently use mock data so that
// the UI can be wired before a real backend exists.

import type {
  Booking,
  Instrument,
  MusicianProfile,
  Perk,
  User,
} from "../types";

export interface ApiClientConfig {
  baseUrl: string;
}

export class TripleAApiClient {
  private baseUrl: string;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    };

    const res = await fetch(url, {
      credentials: "include",
      ...options,
      headers,
    });

    if (!res.ok) {
      const message = await res.text();
      throw new Error(message || `Request failed with ${res.status}`);
    }

    // Some endpoints (e.g. logout 204) may have no body.
    if (res.status === 204) {
      return undefined as T;
    }

    return (await res.json()) as T;
  }

  // --- Auth ---

  async register(params: {
    name: string;
    email: string;
    password: string;
    roles?: string[];
  }): Promise<User> {
    const data = await this.request<{
      id: string;
      name: string;
      email: string;
      roles: string[];
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(params),
    });

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.roles as User["role"],
    };
  }

  async login(email: string, password: string): Promise<User> {
    const data = await this.request<{
      id: string;
      name: string;
      email: string;
      roles: string[];
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.roles as User["role"],
    };
  }

  async logout(): Promise<void> {
    await this.request<void>("/auth/logout", { method: "POST" });
  }

  async getCurrentUser(): Promise<User | null> {
    const data = await this.request<{
      user: {
        id: string;
        name: string;
        email: string;
        roles: string[];
      } | null;
    }>("/auth/me", { method: "GET" });

    if (!data.user) return null;

    return {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.roles as User["role"],
    };
  }

  // Musicians: dashboard overview
  async getMusicianDashboard(musicianId: string): Promise<{
    profile: MusicianProfile;
    upcomingBookings: Booking[];
    perks: Perk[];
  }> {
    // TODO: replace with real fetch(`${this.baseUrl}/musicians/${musicianId}/dashboard`)
    const profile: MusicianProfile = {
      id: musicianId,
      userId: "demo",
      instruments: ["Guitar", "Vocals"],
      genres: ["Pop", "Funk"],
      bio: "Demo musician profile from TripleAApiClient.",
      averageRating: 4.8,
      reviewCount: 42,
    };

    const upcomingBookings: Booking[] = [
      {
        id: "b-demo-1",
        eventId: "e-demo-1",
        musicianId,
        payout: 400,
        status: "confirmed",
      },
    ];

    const perks: Perk[] = [
      {
        id: "perk-demo-1",
        name: "Demo perk",
        description: "Unlocked via API client mock.",
        minRating: 4.5,
      },
    ];

    return { profile, upcomingBookings, perks };
  }

  // Customers: discovery and booking search
  async searchMusicians(params: {
    genre?: string;
    city?: string;
    maxBudget?: number;
  }): Promise<MusicianProfile[]> {
    // TODO: replace with `fetch` using params
    return [
      {
        id: "m-search-1",
        userId: "demo",
        instruments: ["DJ"],
        genres: [params.genre ?? "House"],
        bio: "Mock search result from TripleAApiClient.",
        averageRating: 4.9,
        reviewCount: 120,
      },
    ];
  }

  // Marketplace: catalog view for Muse
  async getMarketplaceCatalog(): Promise<{
    instruments: Instrument[];
  }> {
    const instruments: Instrument[] = [
      {
        id: "i-demo-1",
        name: "Demo Guitar",
        category: "Guitar",
        dailyRate: 30,
        available: true,
      },
    ];

    return { instruments };
  }
}
