// Shared API client shapes for Triple A apps.
// These are intentionally minimal and can mix real backend calls
// (auth/admin/chat) with mocked domain endpoints (dashboards/search).

import type {
  Booking,
  ChatConversation,
  ChatMessage,
  ConcertSearchParams,
  GigApplication,
  Gig,
  GigWithDistance,
  GigWithStats,
  ArtistRequest,
  Instrument,
  Location,
  MusicianProfile,
  StripeOnboardingStatus,
  Perk,
  Permission,
  User,
  UserRole,
  Ticket,
  TicketPurchaseResult,
  TicketQrResult,
  TicketScanResult,
  CheckoutSession,
  CheckoutRequest,
  FeeCalculationResult,
  StaffMember,
  StaffPermission,
  StaffHost,
} from "../types";

export interface ApiClientConfig {
  baseUrl: string;
}

export type EmployeeInviteSummary = {
  id: string;
  email: string;
  roles: UserRole[];
  employeeRoles: string[];
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export class TripleAApiClient {
  private baseUrl: string;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
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
      const contentType = res.headers.get("content-type") ?? "";
      const raw = await res.text();

      let message = raw;
      try {
        if (
          contentType.includes("application/json") ||
          raw.trim().startsWith("{")
        ) {
          const parsed = JSON.parse(raw) as { message?: string };
          if (parsed?.message) message = parsed.message;
        }
      } catch {
        // ignore parse errors; fall back to raw
      }

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
      permissions?: string[];
      employeeRoles?: string[];
      stripeAccountId?: string | null;
      stripeChargesEnabled?: boolean;
      stripePayoutsEnabled?: boolean;
      stripeOnboardingComplete?: boolean;
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(params),
    });

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.roles as User["role"],
      permissions: data.permissions as Permission[] | undefined,
      employeeRoles: data.employeeRoles as User["employeeRoles"],
      stripeAccountId: data.stripeAccountId ?? null,
      stripeChargesEnabled: data.stripeChargesEnabled ?? false,
      stripePayoutsEnabled: data.stripePayoutsEnabled ?? false,
      stripeOnboardingComplete: data.stripeOnboardingComplete ?? false,
    };
  }

  async registerWithInvite(params: {
    token: string;
    name: string;
    email: string;
    password: string;
  }): Promise<User> {
    const data = await this.request<{
      id: string;
      name: string;
      email: string;
      roles: string[];
      permissions?: string[];
      employeeRoles?: string[];
      stripeAccountId?: string | null;
      stripeChargesEnabled?: boolean;
      stripePayoutsEnabled?: boolean;
      stripeOnboardingComplete?: boolean;
    }>("/auth/register-invite", {
      method: "POST",
      body: JSON.stringify(params),
    });

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.roles as User["role"],
      permissions: data.permissions as Permission[] | undefined,
      employeeRoles: data.employeeRoles as User["employeeRoles"],
      stripeAccountId: data.stripeAccountId ?? null,
      stripeChargesEnabled: data.stripeChargesEnabled ?? false,
      stripePayoutsEnabled: data.stripePayoutsEnabled ?? false,
      stripeOnboardingComplete: data.stripeOnboardingComplete ?? false,
    };
  }

  async login(email: string, password: string): Promise<User> {
    const data = await this.request<{
      id: string;
      name: string;
      email: string;
      roles: string[];
      permissions?: string[];
      employeeRoles?: string[];
      stripeAccountId?: string | null;
      stripeChargesEnabled?: boolean;
      stripePayoutsEnabled?: boolean;
      stripeOnboardingComplete?: boolean;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.roles as User["role"],
      permissions: data.permissions as Permission[] | undefined,
      employeeRoles: data.employeeRoles as User["employeeRoles"],
      stripeAccountId: data.stripeAccountId ?? null,
      stripeChargesEnabled: data.stripeChargesEnabled ?? false,
      stripePayoutsEnabled: data.stripePayoutsEnabled ?? false,
      stripeOnboardingComplete: data.stripeOnboardingComplete ?? false,
    };
  }

  async logout(): Promise<void> {
    await this.request<void>("/auth/logout", { method: "POST" });
  }

  async enableMusicianAccess(): Promise<User> {
    const data = await this.request<{
      id: string;
      name: string;
      email: string;
      roles: string[];
      permissions?: string[];
      employeeRoles?: string[];
      stripeAccountId?: string | null;
      stripeChargesEnabled?: boolean;
      stripePayoutsEnabled?: boolean;
      stripeOnboardingComplete?: boolean;
    }>("/auth/enable-musician", { method: "POST" });

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.roles as User["role"],
      permissions: data.permissions as Permission[] | undefined,
      employeeRoles: data.employeeRoles as User["employeeRoles"],
      stripeAccountId: data.stripeAccountId ?? null,
      stripeChargesEnabled: data.stripeChargesEnabled ?? false,
      stripePayoutsEnabled: data.stripePayoutsEnabled ?? false,
      stripeOnboardingComplete: data.stripeOnboardingComplete ?? false,
    };
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    return this.request<{ message: string }>("/auth/request-password-reset", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    return this.request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
    });
  }

  async getCurrentUser(): Promise<User | null> {
    const data = await this.request<{
      user: {
        id: string;
        name: string;
        email: string;
        roles: string[];
        permissions?: string[];
        employeeRoles?: string[];
        stripeAccountId?: string | null;
        stripeChargesEnabled?: boolean;
        stripePayoutsEnabled?: boolean;
        stripeOnboardingComplete?: boolean;
      } | null;
    }>("/auth/me", { method: "GET" });

    if (!data.user) return null;

    return {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.roles as User["role"],
      permissions: data.user.permissions as Permission[] | undefined,
      employeeRoles: data.user.employeeRoles as User["employeeRoles"],
      stripeAccountId: data.user.stripeAccountId ?? null,
      stripeChargesEnabled: data.user.stripeChargesEnabled ?? false,
      stripePayoutsEnabled: data.user.stripePayoutsEnabled ?? false,
      stripeOnboardingComplete: data.user.stripeOnboardingComplete ?? false,
    };
  }

  async createMusicianStripeAccount(): Promise<StripeOnboardingStatus> {
    return await this.request<StripeOnboardingStatus>(
      "/stripe/musicians/account",
      { method: "POST" },
    );
  }

  async getMusicianStripeOnboardingLink(): Promise<{ url: string }> {
    return await this.request<{ url: string }>(
      "/stripe/musicians/onboarding-link",
      { method: "POST" },
    );
  }

  async createMusicianStripeOnboardingSession(): Promise<{
    client_secret: string;
  }> {
    return await this.request<{ client_secret: string }>(
      "/stripe/musicians/onboarding-session",
      { method: "POST" },
    );
  }

  async getMusicianStripeStatus(): Promise<StripeOnboardingStatus> {
    return await this.request<StripeOnboardingStatus>(
      "/stripe/musicians/status",
      { method: "GET" },
    );
  }

  async createFinancialConnectionsSession(
    accountId: string,
  ): Promise<{ clientSecret: string }> {
    return await this.request<{ clientSecret: string }>(
      "/stripe/musicians/financial-connections",
      {
        method: "POST",
        body: JSON.stringify({ accountId }),
      },
    );
  }

  async submitMusicianOnboarding(data: {
    firstName: string;
    lastName: string;
    dob: { day: string; month: string; year: string };
    ssnLast4: string;
    phone: string;
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postal_code: string;
    };
    bankAccountToken: string;
  }): Promise<{
    success: boolean;
    stripeAccountId: string;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    requirements: string[];
  }> {
    return await this.request("/stripe/musicians/onboarding/submit", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // --- Admin ---

  async adminListUsers(): Promise<User[]> {
    const data = await this.request<{
      users: Array<{
        id: string;
        name: string;
        email: string;
        roles: string[];
        permissions?: string[];
        employeeRoles?: string[];
      }>;
    }>("/admin/users", { method: "GET" });

    return data.users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.roles as UserRole[],
      permissions: u.permissions as Permission[] | undefined,
      employeeRoles: u.employeeRoles as User["employeeRoles"],
    }));
  }

  async adminUpdateUser(params: {
    id: string;
    roles?: UserRole[];
    permissions?: Permission[];
    employeeRoles?: User["employeeRoles"];
  }): Promise<User> {
    const data = await this.request<{
      id: string;
      name: string;
      email: string;
      roles: string[];
      permissions?: string[];
      employeeRoles?: string[];
    }>(`/admin/users/${params.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        roles: params.roles,
        permissions: params.permissions,
        employeeRoles: params.employeeRoles,
      }),
    });

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.roles as UserRole[],
      permissions: data.permissions as Permission[] | undefined,
      employeeRoles: data.employeeRoles as User["employeeRoles"],
    };
  }

  async adminCreateEmployeeInvite(params: {
    email: string;
    expiresInHours?: number;
    employeeRoles?: string[];
  }): Promise<{ token: string; email: string; expiresAt: string }> {
    return await this.request<{
      token: string;
      email: string;
      expiresAt: string;
    }>("/admin/invites/employee", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async adminListEmployeeInvites(): Promise<EmployeeInviteSummary[]> {
    const data = await this.request<{
      invites: Array<{
        id: string;
        email: string;
        roles: string[];
        employeeRoles: string[];
        expiresAt: string;
        usedAt: string | null;
        revokedAt: string | null;
        createdAt: string;
      }>;
    }>("/admin/invites/employee", { method: "GET" });

    return data.invites.map((i) => ({
      id: i.id,
      email: i.email,
      roles: i.roles as UserRole[],
      employeeRoles: i.employeeRoles,
      expiresAt: i.expiresAt,
      usedAt: i.usedAt,
      revokedAt: i.revokedAt,
      createdAt: i.createdAt,
    }));
  }

  async adminRevokeEmployeeInvite(
    inviteId: string,
  ): Promise<{ id: string; revokedAt: string }> {
    return await this.request<{ id: string; revokedAt: string }>(
      `/admin/invites/employee/${inviteId}/revoke`,
      { method: "POST" },
    );
  }

  // --- Chat ---

  async chatGetOrCreateSupportConversation(): Promise<ChatConversation> {
    return await this.request<ChatConversation>("/chat/support", {
      method: "POST",
    });
  }

  async chatListConversations(): Promise<ChatConversation[]> {
    const data = await this.request<{ conversations: ChatConversation[] }>(
      "/chat/conversations",
      { method: "GET" },
    );
    return data.conversations;
  }

  async chatListMessages(conversationId: string): Promise<ChatMessage[]> {
    const data = await this.request<{ messages: ChatMessage[] }>(
      `/chat/conversations/${conversationId}/messages`,
      { method: "GET" },
    );
    return data.messages;
  }

  async chatSendMessage(params: {
    conversationId: string;
    body: string;
  }): Promise<ChatMessage> {
    return await this.request<ChatMessage>(
      `/chat/conversations/${params.conversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ body: params.body }),
      },
    );
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
      userId: "local",
      instruments: ["Guitar", "Vocals"],
      genres: ["Pop", "Funk"],
      bio: "Reliable, high‑energy performer for weddings, corporate events, and clubs.",
      averageRating: 4.8,
      reviewCount: 42,
    };

    const upcomingBookings: Booking[] = [
      {
        id: "b-1",
        eventId: "e-1",
        musicianId,
        payout: 400,
        status: "confirmed",
      },
    ];

    const perks: Perk[] = [
      {
        id: "perk-1",
        name: "Priority support",
        description:
          "Fast responses and proactive coordination on tight timelines.",
        minRating: 4.5,
      },
    ];

    return { profile, upcomingBookings, perks };
  }

  // Customers: discovery and booking search
  async musicDiscovery(params: { genre?: string; maxBudget?: number }): Promise<
    Array<{
      musician: MusicianProfile;
      priceEstimate: number;
      distanceMinutes: number;
    }>
  > {
    const qs = new URLSearchParams();
    if (params.genre) qs.set("genre", params.genre);
    if (typeof params.maxBudget === "number")
      qs.set("maxBudget", String(params.maxBudget));

    const data = await this.request<{
      results: Array<{
        musician: MusicianProfile;
        priceEstimate: number;
        distanceMinutes: number;
      }>;
    }>(`/public/music/discovery${qs.toString() ? `?${qs.toString()}` : ""}`, {
      method: "GET",
    });

    return data.results;
  }

  async getPublicMusician(id: string): Promise<MusicianProfile> {
    const data = await this.request<{ musician: MusicianProfile }>(
      `/public/musicians/${encodeURIComponent(id)}`,
      { method: "GET" },
    );
    return data.musician;
  }

  // Marketplace: catalog view for Muse
  async getMarketplaceCatalog(): Promise<{
    instruments: Instrument[];
  }> {
    return await this.request<{ instruments: Instrument[] }>(
      "/public/marketplace/catalog",
      { method: "GET" },
    );
  }

  async getPublicInstrument(id: string): Promise<Instrument> {
    const data = await this.request<{ instrument: Instrument }>(
      `/public/instruments/${encodeURIComponent(id)}`,
      { method: "GET" },
    );
    return data.instrument;
  }

  async listPublicLocations(): Promise<Location[]> {
    const data = await this.request<{ locations: Location[] }>(
      "/public/locations",
      { method: "GET" },
    );
    return data.locations;
  }

  async listPublicGigs(): Promise<Gig[]> {
    const data = await this.request<{ gigs: Gig[] }>("/public/gigs", {
      method: "GET",
    });
    return data.gigs;
  }

  async listPublicConcerts(
    params?: ConcertSearchParams,
  ): Promise<GigWithDistance[]> {
    const qs = params
      ? `?${new URLSearchParams(
          Object.entries(params as Record<string, any>)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([k, v]) => [k, String(v)]),
        ).toString()}`
      : "";

    const data = await this.request<{ concerts: GigWithDistance[] }>(
      `/public/concerts${qs}`,
      { method: "GET" },
    );
    return data.concerts;
  }

  async listPopularConcerts(): Promise<Gig[]> {
    const data = await this.request<{ concerts: Gig[] }>(
      "/public/concerts/popular",
      { method: "GET" },
    );
    return data.concerts;
  }

  async getPublicGig(id: string): Promise<Gig> {
    const data = await this.request<{ gig: Gig }>(
      `/public/gigs/${encodeURIComponent(id)}`,
      { method: "GET" },
    );
    return data.gig;
  }

  /**
   * Get a single gig by ID (host/admin only - for event management)
   */
  async getGig(id: string): Promise<{
    id: string;
    title: string;
    description?: string;
    date: string;
    time?: string;
    budget?: number;
    status: string;
    gigType?: string;
    openForTickets?: boolean;
    ticketPrice?: number;
    seatingType?: string;
    seatCapacity?: number;
    hasTicketTiers?: boolean;
    locationId: string | null;
    location?: {
      id: string;
      name: string;
      address?: string;
      city?: string;
    } | null;
    ticketsSold?: number;
    ticketRevenue?: number;
    createdAt?: string;
  }> {
    return await this.request(`/gigs/${encodeURIComponent(id)}`, {
      method: "GET",
    });
  }

  async createGig(params: {
    title: string;
    description?: string;
    date: string;
    time?: string;
    budget?: number;
    locationId?: string;
    location?: { name: string; address?: string; city?: string };
  }): Promise<{
    id: string;
    title: string;
    description?: string;
    date: string;
    time?: string;
    budget?: number;
    status: string;
    locationId: string | null;
  }> {
    return await this.request("/gigs", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async listMyGigs(): Promise<GigWithStats[]> {
    const data = await this.request<{
      gigs: Array<
        Omit<Gig, "location"> & {
          locationId?: string | null;
          gigType?: string;
          ticketsSold?: number;
          ticketRevenue?: number;
          applicantCount?: number;
        }
      >;
    }>("/gigs/mine", { method: "GET" });

    return data.gigs.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      date: g.date,
      time: g.time,
      budget: g.budget,
      status: g.status,
      gigType: g.gigType as Gig["gigType"],
      openForTickets: g.openForTickets,
      ticketPrice: g.ticketPrice,
      location: null,
      ticketsSold: g.ticketsSold ?? 0,
      ticketRevenue: g.ticketRevenue ?? 0,
      applicantCount: g.applicantCount ?? 0,
    }));
  }

  async applyToGig(
    gigId: string,
    params: { message?: string },
  ): Promise<{
    id: string;
    gigId: string;
    status: string;
    message: string | null;
    createdAt: string;
  }> {
    return await this.request(`/gigs/${encodeURIComponent(gigId)}/apply`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async listGigApplications(gigId: string): Promise<GigApplication[]> {
    const data = await this.request<{ applications: GigApplication[] }>(
      `/gigs/${encodeURIComponent(gigId)}/applications`,
      { method: "GET" },
    );
    return data.applications;
  }

  async decideGigApplication(params: {
    gigId: string;
    applicationId: string;
    decision: "accept" | "deny";
  }): Promise<{ id: string; status: string; decidedAt: string }> {
    return await this.request(
      `/gigs/${encodeURIComponent(
        params.gigId,
      )}/applications/${encodeURIComponent(params.applicationId)}/decision`,
      {
        method: "POST",
        body: JSON.stringify({ decision: params.decision }),
      },
    );
  }

  // --- Musician profile & direct request settings ---

  async getMyMusicianProfile(): Promise<MusicianProfile> {
    const data = await this.request<{ musician: MusicianProfile }>(
      "/musicians/me",
      { method: "GET" },
    );
    return data.musician;
  }

  async updateMyMusicianProfile(params: {
    instruments?: string[];
    genres?: string[];
    bio?: string;
    defaultHourlyRate?: number | null;
    acceptsDirectRequests?: boolean;
  }): Promise<MusicianProfile> {
    const data = await this.request<{ musician: MusicianProfile }>(
      "/musicians/me",
      {
        method: "PATCH",
        body: JSON.stringify(params),
      },
    );
    return data.musician;
  }

  // --- Host stages / locations ---

  async createStageLocation(params: {
    name: string;
    address?: string;
    city?: string;
  }): Promise<Location> {
    const data = await this.request<Location>("/locations", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return data;
  }

  /** Upload images for an existing location. Accepts File[] and returns upload summary. */
  async uploadLocationImages(
    locationId: string,
    files: File[],
  ): Promise<{ uploaded: number; total: number }> {
    const url = `${this.baseUrl}/locations/${encodeURIComponent(locationId)}/images`;
    const fd = new FormData();
    files.forEach((f) => fd.append("images", f, f.name));

    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      body: fd,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Upload failed with ${res.status}`);
    }

    return (await res.json()) as { uploaded: number; total: number };
  }

  async listMyStageLocations(): Promise<Location[]> {
    const data = await this.request<{ locations: Location[] }>(
      "/locations/mine",
      { method: "GET" },
    );
    return data.locations;
  }

  // --- Direct artist requests for gigs ---

  async requestArtistForGig(params: {
    gigId: string;
    musicianUserId: string;
    priceOffered?: number;
    message?: string;
  }): Promise<ArtistRequest> {
    const data = await this.request<ArtistRequest>(
      `/gigs/${encodeURIComponent(params.gigId)}/request-artist`,
      {
        method: "POST",
        body: JSON.stringify({
          musicianUserId: params.musicianUserId,
          priceOffered: params.priceOffered,
          message: params.message,
        }),
      },
    );
    return data;
  }

  async listMyArtistRequests(): Promise<ArtistRequest[]> {
    const data = await this.request<{ requests: ArtistRequest[] }>(
      "/artist-requests/mine",
      { method: "GET" },
    );
    return data.requests;
  }

  async decideArtistRequest(params: {
    id: string;
    decision: "accept" | "decline";
  }): Promise<{ id: string; status: string; decidedAt: string }> {
    return await this.request<{
      id: string;
      status: string;
      decidedAt: string;
    }>(`/artist-requests/${encodeURIComponent(params.id)}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision: params.decision }),
    });
  }

  // --- Admin / employee: instrument listings ---

  async createInstrumentListing(params: {
    name: string;
    category: string;
    dailyRate: number;
    available?: boolean;
  }): Promise<Instrument> {
    const data = await this.request<Instrument>("/instruments", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return data;
  }

  // --- Tickets ---

  async purchaseTickets(params: {
    gigId: string;
    quantity: number;
    email: string;
    holderName: string;
    tierId?: string;
    seatIds?: string[];
  }): Promise<TicketPurchaseResult> {
    return await this.request<TicketPurchaseResult>("/tickets/purchase", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async getTicketByConfirmationCode(code: string): Promise<{
    ticket: Ticket;
    gig: Ticket["gig"];
    location: Ticket["location"];
  }> {
    return await this.request(`/tickets/confirm/${encodeURIComponent(code)}`, {
      method: "GET",
    });
  }

  async getTicketQrCode(
    ticketId: string,
    confirmationCode?: string,
  ): Promise<TicketQrResult> {
    return await this.request<TicketQrResult>(
      `/tickets/${encodeURIComponent(ticketId)}/qr`,
      {
        method: "POST",
        body: JSON.stringify({ confirmationCode }),
      },
    );
  }

  async getMyTickets(): Promise<{ tickets: Ticket[] }> {
    return await this.request<{ tickets: Ticket[] }>("/tickets/mine", {
      method: "GET",
    });
  }

  async scanTicket(
    qrPayload: string,
    gigId?: string,
  ): Promise<TicketScanResult> {
    return await this.request<TicketScanResult>("/tickets/scan", {
      method: "POST",
      body: JSON.stringify({ qrPayload, gigId }),
    });
  }

  async markTicketUsed(ticketId: string): Promise<{
    success: boolean;
    ticket: {
      id: string;
      confirmationCode: string;
      status: string;
      usedAt: string;
    };
  }> {
    return await this.request(`/tickets/${encodeURIComponent(ticketId)}/use`, {
      method: "POST",
    });
  }

  async getGigTickets(gigId: string): Promise<{
    tickets: Array<{
      id: string;
      confirmationCode: string;
      quantity: number;
      holderName: string;
      email: string;
      totalPaid: number;
      status: string;
      usedAt: string | null;
      createdAt: string;
      tierName?: string;
      seatAssignments?: Array<{
        seatId: string;
        section: string;
        row: string;
        seatNumber: string;
      }>;
      isComped?: boolean;
      issuedByHost?: boolean;
    }>;
    stats: {
      total: number;
      valid: number;
      used: number;
      cancelled: number;
      revenue: number;
    };
  }> {
    return await this.request(`/tickets/gig/${encodeURIComponent(gigId)}`, {
      method: "GET",
    });
  }

  /**
   * Issue tickets to a specific email (host/admin only)
   * Use cases: comp tickets, walk-ins, gifted tickets
   */
  async issueTicket(params: {
    gigId: string;
    email: string;
    holderName: string;
    quantity?: number;
    tierId?: string;
    seatIds?: string[];
    sendEmail?: boolean;
    note?: string;
    isComp?: boolean;
  }): Promise<{
    ticket: {
      id: string;
      confirmationCode: string;
      gigId: string;
      quantity: number;
      pricePerTicket: number;
      totalPaid: number;
      status: string;
      holderName: string;
      email: string;
      tierId: string | null;
      tierName?: string;
      seatAssignments?: Array<{
        seatId: string;
        section: string;
        row: string;
        seatNumber: string;
      }>;
      isComp: boolean;
      createdAt: string;
    };
    emailSent: boolean;
  }> {
    return await this.request("/tickets/issue", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  /**
   * Cancel a ticket (host/admin only)
   */
  async cancelTicket(
    ticketId: string,
    params?: { reason?: string; sendEmail?: boolean },
  ): Promise<{
    success: boolean;
    ticket: {
      id: string;
      confirmationCode: string;
      status: string;
    };
  }> {
    return await this.request(
      `/tickets/${encodeURIComponent(ticketId)}/cancel`,
      {
        method: "POST",
        body: JSON.stringify(params ?? {}),
      },
    );
  }

  /**
   * Resend ticket confirmation email (host/admin only)
   */
  async resendTicketEmail(ticketId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return await this.request(
      `/tickets/${encodeURIComponent(ticketId)}/resend`,
      {
        method: "POST",
      },
    );
  }

  // --- Stripe / Payments ---

  async createCheckoutSession(
    params: CheckoutRequest,
  ): Promise<CheckoutSession> {
    return await this.request<CheckoutSession>("/stripe/create-checkout", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async confirmPayment(paymentIntentId: string): Promise<TicketPurchaseResult> {
    return await this.request<TicketPurchaseResult>("/stripe/confirm-payment", {
      method: "POST",
      body: JSON.stringify({ paymentIntentId }),
    });
  }

  async calculateFees(
    gigId: string,
    quantity: number,
    tierId?: string,
  ): Promise<FeeCalculationResult> {
    return await this.request<FeeCalculationResult>("/stripe/calculate-fees", {
      method: "POST",
      body: JSON.stringify({ gigId, quantity, tierId }),
    });
  }

  // --- Seating & Tiers ---

  async getGigTicketTiers(gigId: string): Promise<{
    tiers: Array<{
      id: string;
      gigId: string;
      name: string;
      description?: string;
      tierType: string;
      price: number;
      capacity: number;
      sold: number;
      remaining: number;
      available: boolean;
      sortOrder: number;
      color?: string;
    }>;
  }> {
    return await this.request(
      `/seating/gigs/${encodeURIComponent(gigId)}/tiers`,
      {
        method: "GET",
      },
    );
  }

  async createTicketTier(
    gigId: string,
    params: {
      name: string;
      description?: string;
      tierType?: string;
      price: number;
      capacity: number;
      color?: string;
      sortOrder?: number;
    },
  ): Promise<{
    tier: {
      id: string;
      gigId: string;
      name: string;
      description?: string;
      tierType: string;
      price: number;
      capacity: number;
      sold: number;
      remaining: number;
      available: boolean;
      sortOrder: number;
      color?: string;
    };
  }> {
    return await this.request(
      `/seating/gigs/${encodeURIComponent(gigId)}/tiers`,
      {
        method: "POST",
        body: JSON.stringify(params),
      },
    );
  }

  async updateTicketTier(
    tierId: string,
    updates: {
      name?: string;
      description?: string;
      price?: number;
      capacity?: number;
      available?: boolean;
      color?: string;
      sortOrder?: number;
    },
  ): Promise<{
    tier: {
      id: string;
      name: string;
      price: number;
      capacity: number;
      sold: number;
      remaining: number;
      available: boolean;
    };
  }> {
    return await this.request(`/seating/tiers/${encodeURIComponent(tierId)}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async deleteTicketTier(tierId: string): Promise<{ success: boolean }> {
    return await this.request(`/seating/tiers/${encodeURIComponent(tierId)}`, {
      method: "DELETE",
    });
  }

  async getGigSeatingLayout(gigId: string): Promise<{
    layout: {
      id: string;
      name: string;
      locationId: string;
      description?: string;
      totalCapacity: number;
      sections: Array<{
        sectionId: string;
        name: string;
        color?: string;
        defaultTierId?: string;
        rows: string[];
        seatsPerRow: number[];
      }>;
      seats: Array<{
        seatId: string;
        row: string;
        seatNumber: string;
        section: string;
        floorId?: string;
        tierId?: string;
        posX?: number;
        posY?: number;
        isAvailable: boolean;
        accessibility?: string[];
      }>;
      floors?: Array<{ floorId: string; name: string; order: number }>;
      stagePosition?: string;
    } | null;
  }> {
    return await this.request(
      `/seating/gigs/${encodeURIComponent(gigId)}/layout`,
      {
        method: "GET",
      },
    );
  }

  async getAvailableSeats(gigId: string): Promise<{
    layout: {
      id: string;
      name: string;
      locationId: string;
      description?: string;
      totalCapacity: number;
      sections: Array<{
        sectionId: string;
        name: string;
        color?: string;
        defaultTierId?: string;
        rows: string[];
        seatsPerRow: number[];
      }>;
      seats: Array<{
        seatId: string;
        row: string;
        seatNumber: string;
        section: string;
        floorId?: string;
        tierId?: string;
        posX?: number;
        posY?: number;
        isAvailable: boolean;
        isSold?: boolean;
      }>;
      floors?: Array<{ floorId: string; name: string; order: number }>;
      stagePosition?: string;
    };
    soldSeatIds: string[];
    tiers: Array<{
      id: string;
      name: string;
      price: number;
      color?: string;
      remaining: number;
    }>;
  }> {
    return await this.request(
      `/seating/gigs/${encodeURIComponent(gigId)}/available-seats`,
      {
        method: "GET",
      },
    );
  }

  async createSeatingLayout(
    gigId: string,
    params: {
      name: string;
      sections?: Array<{
        name: string;
        rows: number;
        seatsPerRow: number;
        tierId?: string;
        color?: string;
      }>;
      stagePosition?: "top" | "bottom" | "left" | "right";
      useSimpleLayout?: boolean;
    },
  ): Promise<{
    layout: {
      id: string;
      name: string;
      totalCapacity: number;
      sections: Array<{ sectionId: string; name: string }>;
    };
  }> {
    return await this.request(
      `/seating/gigs/${encodeURIComponent(gigId)}/layout`,
      {
        method: "POST",
        body: JSON.stringify(params),
      },
    );
  }

  async cloneTemplateLayoutToGig(
    gigId: string,
    templateLayoutId: string,
  ): Promise<{
    layout: {
      id: string;
      name: string;
      locationId: string;
      description?: string;
      totalCapacity: number;
      sections: Array<{
        sectionId: string;
        name: string;
        color?: string;
        defaultTierId?: string;
        rows: string[];
        seatsPerRow: number[];
      }>;
      seats: Array<{
        seatId: string;
        row: string;
        seatNumber: string;
        section: string;
        floorId?: string;
        tierId?: string;
        posX?: number;
        posY?: number;
        isAvailable: boolean;
        accessibility?: string[];
      }>;
      floors?: Array<{ floorId: string; name: string; order: number }>;
      stagePosition?: "top" | "bottom" | "left" | "right";
    };
  }> {
    return await this.request(
      `/seating/gigs/${encodeURIComponent(gigId)}/layout/clone`,
      {
        method: "POST",
        body: JSON.stringify({ templateLayoutId }),
      },
    );
  }

  async updateGigSeatingConfig(
    gigId: string,
    config: {
      seatingType?: "general_admission" | "reserved" | "mixed";
      seatCapacity?: number;
      ticketPrice?: number;
    },
  ): Promise<{
    gig: {
      id: string;
      seatingType: string;
      seatCapacity?: number;
      ticketPrice?: number;
      hasTicketTiers: boolean;
      seatingLayoutId?: string;
    };
  }> {
    return await this.request(
      `/seating/gigs/${encodeURIComponent(gigId)}/config`,
      {
        method: "PATCH",
        body: JSON.stringify(config),
      },
    );
  }

  async updateLocationCapacity(
    locationId: string,
    seatCapacity: number,
  ): Promise<{
    location: {
      id: string;
      name: string;
      seatCapacity: number;
    };
  }> {
    return await this.request(
      `/seating/locations/${encodeURIComponent(locationId)}/capacity`,
      {
        method: "PATCH",
        body: JSON.stringify({ seatCapacity }),
      },
    );
  }

  async listLocationSeatingLayouts(locationId: string): Promise<{
    layouts: Array<{
      id: string;
      name: string;
      description?: string;
      totalCapacity: number;
      isTemplate: boolean;
      stagePosition?: "top" | "bottom" | "left" | "right";
    }>;
  }> {
    return await this.request(
      `/seating/locations/${encodeURIComponent(locationId)}/layouts`,
      { method: "GET" },
    );
  }

  async createLocationSeatingLayout(
    locationId: string,
    params: {
      name: string;
      description?: string;
      sections?: Array<{
        name: string;
        rows: number;
        seatsPerRow: number;
        tierId?: string;
        color?: string;
      }>;
      stagePosition?: "top" | "bottom" | "left" | "right";
      useSimpleLayout?: boolean;
    },
  ): Promise<{
    layout: {
      id: string;
      name: string;
      locationId: string;
      description?: string;
      totalCapacity: number;
      sections: Array<{
        sectionId: string;
        name: string;
        color?: string;
        defaultTierId?: string;
        rows: string[];
        seatsPerRow: number[];
      }>;
      seats: Array<{
        seatId: string;
        row: string;
        seatNumber: string;
        section: string;
        floorId?: string;
        tierId?: string;
        posX?: number;
        posY?: number;
        isAvailable: boolean;
        accessibility?: string[];
      }>;
      floors?: Array<{ floorId: string; name: string; order: number }>;
      isTemplate: boolean;
      stagePosition?: "top" | "bottom" | "left" | "right";
    };
  }> {
    return await this.request(
      `/seating/locations/${encodeURIComponent(locationId)}/layouts`,
      {
        method: "POST",
        body: JSON.stringify(params),
      },
    );
  }

  async getSeatingLayout(layoutId: string): Promise<{
    layout: {
      id: string;
      name: string;
      locationId: string;
      description?: string;
      backgroundImageUrl?: string;
      totalCapacity: number;
      sections: Array<{
        sectionId: string;
        name: string;
        color?: string;
        defaultTierId?: string;
        rows: string[];
        seatsPerRow: number[];
      }>;
      seats: Array<{
        seatId: string;
        row: string;
        seatNumber: string;
        section: string;
        floorId?: string;
        tierId?: string;
        posX?: number;
        posY?: number;
        isAvailable: boolean;
        accessibility?: string[];
        rowGroupId?: string;
        detachedFromRow?: boolean;
      }>;
      floors?: Array<{ floorId: string; name: string; order: number }>;
      elements?: Array<{
        elementId: string;
        type: "aisle";
        floorId?: string;
        orientation: "vertical" | "horizontal";
        x: number;
        y: number;
        length: number;
        thickness: number;
        label?: string;
      }>;
      stage?: {
        x: number;
        y: number;
        width: number;
        height: number;
        shape?: "rect" | "rounded";
        cornerRadius?: number;
      };
      isTemplate: boolean;
      stagePosition?: "top" | "bottom" | "left" | "right";
      createdAt: string;
      updatedAt: string;
    };
  }> {
    return await this.request(
      `/seating/layouts/${encodeURIComponent(layoutId)}`,
      {
        method: "GET",
      },
    );
  }

  async updateSeatingLayout(
    layoutId: string,
    updates: {
      name?: string;
      description?: string;
      stagePosition?: "top" | "bottom" | "left" | "right";
      backgroundImageUrl?: string;
      floors?: Array<{ floorId: string; name: string; order: number }>;
      elements?: Array<{
        elementId: string;
        type: "aisle";
        floorId?: string;
        orientation: "vertical" | "horizontal";
        x: number;
        y: number;
        length: number;
        thickness: number;
        label?: string;
      }>;
      stage?: {
        x: number;
        y: number;
        width: number;
        height: number;
        shape?: "rect" | "rounded";
        cornerRadius?: number;
      };
      sections?: Array<{
        sectionId: string;
        name: string;
        color?: string;
        defaultTierId?: string;
        rows: string[];
        seatsPerRow: number[];
      }>;
      seats?: Array<{
        seatId: string;
        row: string;
        seatNumber: string;
        section: string;
        floorId?: string;
        tierId?: string;
        posX?: number;
        posY?: number;
        isAvailable: boolean;
        accessibility?: string[];
        rowGroupId?: string;
        detachedFromRow?: boolean;
      }>;
    },
  ): Promise<{
    layout: {
      id: string;
      name: string;
      locationId: string;
      description?: string;
      totalCapacity: number;
      sections: Array<{
        sectionId: string;
        name: string;
        color?: string;
        defaultTierId?: string;
        rows: string[];
        seatsPerRow: number[];
      }>;
      seats: Array<{
        seatId: string;
        row: string;
        seatNumber: string;
        section: string;
        tierId?: string;
        posX?: number;
        posY?: number;
        isAvailable: boolean;
        accessibility?: string[];
        rowGroupId?: string;
        detachedFromRow?: boolean;
      }>;
      isTemplate: boolean;
      stagePosition?: "top" | "bottom" | "left" | "right";
      createdAt: string;
      updatedAt: string;
    };
  }> {
    return await this.request(
      `/seating/layouts/${encodeURIComponent(layoutId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(updates),
      },
    );
  }

  // ===== Staff Management =====

  async inviteStaff(params: {
    email: string;
    permissions?: StaffPermission[];
    staffName?: string;
  }): Promise<{ invite: StaffMember }> {
    return await this.request<{ invite: StaffMember }>("/staff/invite", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async listStaff(): Promise<StaffMember[]> {
    const data = await this.request<{ staff: StaffMember[] }>("/staff", {
      method: "GET",
    });
    return data.staff;
  }

  async updateStaffMember(
    id: string,
    params: { permissions?: StaffPermission[]; staffName?: string },
  ): Promise<{ staff: StaffMember }> {
    return await this.request<{ staff: StaffMember }>(
      `/staff/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(params),
      },
    );
  }

  async removeStaffMember(id: string): Promise<{ success: boolean }> {
    return await this.request<{ success: boolean }>(
      `/staff/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      },
    );
  }

  async resendStaffInvite(
    id: string,
  ): Promise<{ success: boolean; expiresAt: string }> {
    return await this.request<{ success: boolean; expiresAt: string }>(
      `/staff/${encodeURIComponent(id)}/resend`,
      {
        method: "POST",
      },
    );
  }

  async updateStaffInviteEmail(
    id: string,
    email: string,
  ): Promise<{ success: boolean; email: string; expiresAt: string }> {
    return await this.request<{
      success: boolean;
      email: string;
      expiresAt: string;
    }>(`/staff/${encodeURIComponent(id)}/email`, {
      method: "PATCH",
      body: JSON.stringify({ email }),
    });
  }

  async getStaffInviteInfo(token: string): Promise<{
    invite: {
      email: string;
      hostName: string;
      permissions: StaffPermission[];
      isExistingUser: boolean;
    };
  }> {
    return await this.request(`/staff/join/${encodeURIComponent(token)}`, {
      method: "GET",
    });
  }

  async acceptStaffInvite(
    token: string,
  ): Promise<{ success: boolean; message: string }> {
    return await this.request<{ success: boolean; message: string }>(
      `/staff/join/${encodeURIComponent(token)}/link`,
      {
        method: "POST",
      },
    );
  }

  async registerAndAcceptStaffInvite(
    token: string,
    params: { name: string; password: string },
  ): Promise<{ success: boolean; message: string; userId: string }> {
    return await this.request<{
      success: boolean;
      message: string;
      userId: string;
    }>(`/staff/join/${encodeURIComponent(token)}/register`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async getMyStaffHosts(): Promise<StaffHost[]> {
    const data = await this.request<{ hosts: StaffHost[] }>("/staff/my-hosts", {
      method: "GET",
    });
    return data.hosts;
  }
}
