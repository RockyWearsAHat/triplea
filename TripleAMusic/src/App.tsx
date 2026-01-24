import React, { useEffect, useMemo, useState } from "react";
import type {
  Booking,
  Event,
  Gig,
  GigApplication,
  Location,
  MusicianProfile,
} from "@shared";
import {
  AppFrame,
  AppShell,
  Button,
  spacing,
  TripleAApiClient,
  RequireAnyRole,
  RequireRole,
  useScrollReveal,
  useAuth,
} from "@shared";
import {
  NavLink,
  Route,
  Routes,
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import "./App.css";
import ui from "@shared/styles/primitives.module.scss";

import { ChatInbox } from "@shared";

interface DiscoveryResult {
  musician: MusicianProfile;
  priceEstimate: number;
  distanceMinutes: number;
}

function formatUsd(amount: number): string {
  if (!Number.isFinite(amount)) return "$0";
  return `$${amount.toFixed(0)}`;
}

type TicketOrderStatus = "confirmed" | "refunded" | "transferred";

type TicketOrder = {
  id: string;
  gigId: string;
  quantity: number;
  unitPrice: number;
  platformFee: number;
  total: number;
  currency: "USD";
  purchasedAt: string;
  status: TicketOrderStatus;
  accessCode: string;
};

function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
}

function loadTicketOrders(): TicketOrder[] {
  try {
    const raw = localStorage.getItem("taa.music.ticketOrders");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TicketOrder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTicketOrders(next: TicketOrder[]): void {
  try {
    localStorage.setItem("taa.music.ticketOrders", JSON.stringify(next));
  } catch {
    // ignore
  }
}

const events: Event[] = [
  {
    id: "e1",
    title: "Summer rooftop launch",
    date: "2026-08-12",
    time: "19:30",
    venue: "Skyline Rooftop",
    budget: 1500,
  },
  {
    id: "e2",
    title: "Corporate offsite dinner",
    date: "2026-09-05",
    time: "18:00",
    venue: "Harbor Hall",
    budget: 3200,
  },
];

const bookings: Booking[] = [
  {
    id: "b1",
    eventId: "e1",
    musicianId: "m1",
    payout: 780,
    status: "confirmed",
  },
  {
    id: "b2",
    eventId: "e2",
    musicianId: "m2",
    payout: 1200,
    status: "requested",
  },
];

function Chip({ label }: { label: string }) {
  return <span className={ui.chip}>{label}</span>;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={ui.section}>
      <h2 className={ui.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);

      const next = searchParams.get("next");
      if (next && next.startsWith("/")) {
        navigate(next);
        return;
      }

      navigate("/dashboard");
    } catch (err) {
      setError("Login failed. Please check your details and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const userRoles = user?.role ?? [];
  const isCustomer = userRoles.includes("customer");
  const hasAnyRole = userRoles.length > 0;

  return (
    <AppShell title="Sign in">
      <form
        onSubmit={handleSubmit}
        style={{
          maxWidth: 360,
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13 }}>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={ui.input}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13 }}>Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={ui.input}
          />
        </div>
        {error && <p className={ui.error}>{error}</p>}
        {user && (
          <p className={ui.help}>
            {user.email}
            {!isCustomer &&
              hasAnyRole &&
              " · This account is not set up as a host yet."}
          </p>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate("/register")}
        >
          Create an account for bookings
        </Button>
      </form>
    </AppShell>
  );
}

function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({ name, email, password, roles: ["customer"] });
      navigate("/");
    } catch (err) {
      setError("Registration failed. Please try a different email.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="Create account">
      <form
        onSubmit={handleSubmit}
        style={{
          maxWidth: 360,
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13 }}>Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={ui.input}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13 }}>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={ui.input}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13 }}>Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={ui.input}
          />
        </div>
        {error && <p className={ui.error}>{error}</p>}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create account"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate("/login")}
        >
          Back to login
        </Button>
      </form>
    </AppShell>
  );
}
function CustomerDashboardPage() {
  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: "http://localhost:4000/api" }),
    [],
  );

  const { user } = useAuth();

  const [discoveryResults, setDiscoveryResults] = useState<DiscoveryResult[]>(
    [],
  );
  const [discoveryBusy, setDiscoveryBusy] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  const [myStages, setMyStages] = useState<Location[]>([]);
  const [stageName, setStageName] = useState("");
  const [stageAddress, setStageAddress] = useState("");
  const [stageCity, setStageCity] = useState("");
  const [stageBusy, setStageBusy] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);

  const [activeRequestMusician, setActiveRequestMusician] =
    useState<DiscoveryResult | null>(null);
  const [myGigs, setMyGigs] = useState<Gig[]>([]);
  const [requestGigId, setRequestGigId] = useState<string>("");
  const [requestPrice, setRequestPrice] = useState<string>("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);

  useEffect(() => {
    setDiscoveryError(null);
    setDiscoveryBusy(true);
    api
      .musicDiscovery({})
      .then((results) => setDiscoveryResults(results))
      .catch((err) =>
        setDiscoveryError(
          err instanceof Error ? err.message : "Failed to load discovery",
        ),
      )
      .finally(() => setDiscoveryBusy(false));
  }, [api]);

  useEffect(() => {
    if (!user) return;
    api
      .listMyStageLocations()
      .then((res) => setMyStages(res))
      .catch(() => {
        // Ignore errors for now; user might not be a host yet.
      });
  }, [api, user]);

  function apiImageUrl(pathname?: string): string | undefined {
    if (!pathname) return undefined;
    if (/^https?:\/\//i.test(pathname)) return pathname;
    return `http://localhost:4000${pathname}`;
  }

  useEffect(() => {
    if (!activeRequestMusician) return;
    if (!user) return;
    if (myGigs.length > 0) return;
    api
      .listMyGigs()
      .then((g) => setMyGigs(g))
      .catch(() => {
        // Best-effort; surface errors when submitting.
      });
  }, [activeRequestMusician, user, myGigs.length, api]);

  async function handleCreateStage(e: React.FormEvent) {
    e.preventDefault();
    setStageError(null);
    setStageBusy(true);
    try {
      const created = await api.createStageLocation({
        name: stageName,
        address: stageAddress,
        city: stageCity,
      });
      setMyStages((prev) => [created, ...prev]);
      setStageName("");
      setStageAddress("");
      setStageCity("");
    } catch (err) {
      setStageError(
        err instanceof Error ? err.message : "Failed to create stage",
      );
    } finally {
      setStageBusy(false);
    }
  }

  function startRequestFor(result: DiscoveryResult) {
    setActiveRequestMusician(result);
    setRequestError(null);
    setRequestSuccess(null);
    const suggested =
      typeof result.musician.defaultHourlyRate === "number" &&
      result.musician.defaultHourlyRate > 0
        ? result.musician.defaultHourlyRate
        : result.priceEstimate;
    setRequestPrice(String(Math.round(suggested)));
    setRequestGigId("");
  }

  async function handleSubmitArtistRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!activeRequestMusician) return;
    setRequestError(null);
    setRequestSuccess(null);
    setRequestBusy(true);
    try {
      if (!requestGigId) {
        throw new Error("Select a gig to attach this request to.");
      }
      const price = Number(requestPrice);
      if (!Number.isFinite(price) || price <= 0) {
        throw new Error("Enter a positive offer amount.");
      }

      await api.requestArtistForGig({
        gigId: requestGigId,
        musicianUserId: activeRequestMusician.musician.userId,
        priceOffered: price,
      });

      setRequestSuccess("Request sent to artist.");
    } catch (err) {
      setRequestError(
        err instanceof Error ? err.message : "Failed to send request",
      );
    } finally {
      setRequestBusy(false);
    }
  }

  return (
    <AppShell
      title="Host console"
      subtitle="Operations for venues, postings, requests, and bookings."
    >
      <div
        style={{ display: "flex", flexDirection: "column", gap: spacing.xl }}
      >
        <Section title="Event setup">
          <div
            className={[ui.card, ui.cardPad].join(" ")}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing.md,
            }}
          >
            <div style={{ display: "flex", gap: spacing.md, flexWrap: "wrap" }}>
              <input
                placeholder="Describe your event (e.g. rooftop cocktail, wedding)"
                className={ui.input}
                style={{ flex: "1 1 260px" }}
              />
              <input
                placeholder="Guests"
                className={ui.input}
                style={{ width: 120 }}
              />
              <input
                placeholder="Budget"
                className={ui.input}
                style={{ width: 140 }}
              />
            </div>
            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              <Chip label="Solo" />
              <Chip label="Band" />
              <Chip label="DJ" />
              <Chip label="Acoustic" />
              <Chip label="Background only" />
            </div>
            <Button style={{ alignSelf: "flex-start" }}>
              See matching musicians
            </Button>
          </div>
        </Section>

        <Section title="Your stages & locations">
          {!user ? (
            <p className={ui.help}>
              Sign in as a host to post stages and gig locations.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: spacing.md,
              }}
            >
              <form
                onSubmit={handleCreateStage}
                className={[ui.card, ui.cardPad].join(" ")}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: spacing.sm,
                  maxWidth: 520,
                }}
              >
                <p className={ui.help}>
                  Post a stage or venue you host events at. You can reuse it
                  across multiple gigs.
                </p>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  <label style={{ fontSize: 13 }}>Stage name</label>
                  <input
                    required
                    value={stageName}
                    onChange={(e) => setStageName(e.target.value)}
                    placeholder="e.g. Skyline Rooftop, Harbor Hall"
                    className={ui.input}
                  />
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  <label style={{ fontSize: 13 }}>Address (optional)</label>
                  <input
                    value={stageAddress}
                    onChange={(e) => setStageAddress(e.target.value)}
                    className={ui.input}
                  />
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  <label style={{ fontSize: 13 }}>City (optional)</label>
                  <input
                    value={stageCity}
                    onChange={(e) => setStageCity(e.target.value)}
                    className={ui.input}
                  />
                </div>
                {stageError && <p className={ui.error}>{stageError}</p>}
                <Button type="submit" disabled={stageBusy}>
                  {stageBusy ? "Posting stage..." : "Post stage"}
                </Button>
              </form>

              {myStages.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: spacing.sm,
                  }}
                >
                  {myStages.map((stage) => (
                    <div
                      key={stage.id}
                      className={[ui.card, ui.cardPad].join(" ")}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "96px 1fr",
                        gap: spacing.md,
                        alignItems: "center",
                      }}
                    >
                      <div className={[ui.media, ui.mediaSquare].join(" ")}>
                        {stage.imageUrl ? (
                          <img
                            src={apiImageUrl(stage.imageUrl)}
                            alt={stage.name}
                            loading="lazy"
                          />
                        ) : null}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 650 }}>{stage.name}</div>
                        {(stage.address || stage.city) && (
                          <div className={ui.help}>
                            {[stage.address, stage.city]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={ui.help}>
                  You haven&apos;t posted any stages yet.
                </p>
              )}
            </div>
          )}
        </Section>

        <Section title="Discovery & search">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing.md,
            }}
          >
            {discoveryBusy && (
              <p className={ui.help}>Loading discovery results...</p>
            )}
            {discoveryError && <p className={ui.error}>{discoveryError}</p>}
            {discoveryResults.map((result) => (
              <div
                key={result.musician.id}
                className={[ui.card, ui.cardPad].join(" ")}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: spacing.lg,
                  justifyContent: "space-between",
                }}
              >
                <div style={{ flex: "1 1 220px" }}>
                  <h3 style={{ fontWeight: 600 }}>
                    #{result.musician.id.toUpperCase()}
                  </h3>
                  <p
                    style={{
                      marginTop: spacing.xs,
                      fontSize: 14,
                    }}
                    className={ui.help}
                  >
                    {result.musician.bio}
                  </p>
                  <p style={{ marginTop: spacing.xs, fontSize: 14 }}>
                    {result.musician.genres.join(" · ")} ·{" "}
                    {result.musician.instruments.join(", ")}
                  </p>
                  <p
                    style={{
                      marginTop: spacing.xs,
                      fontSize: 13,
                    }}
                    className={ui.help}
                  >
                    {result.musician.averageRating.toFixed(1)} ★ ·{" "}
                    {result.musician.reviewCount}+ reviews · ~
                    {result.distanceMinutes} min away
                  </p>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: spacing.sm,
                    minWidth: 180,
                  }}
                >
                  <p style={{ fontSize: 14 }}>Est. quote</p>
                  <p style={{ fontSize: 24, fontWeight: 600 }}>
                    ${result.priceEstimate.toFixed(0)}
                  </p>
                  {result.musician.acceptsDirectRequests ? (
                    <Button fullWidth onClick={() => startRequestFor(result)}>
                      Request this artist
                    </Button>
                  ) : (
                    <Button fullWidth disabled>
                      Not accepting direct requests
                    </Button>
                  )}
                  <Button variant="ghost" fullWidth>
                    View profile
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {activeRequestMusician && (
          <Section title="Request artist for a gig">
            <form
              onSubmit={handleSubmitArtistRequest}
              className={[ui.card, ui.cardPad].join(" ")}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: spacing.md,
              }}
            >
              <p style={{ fontSize: 14 }}>
                You are requesting:
                <br />
                <span style={{ fontWeight: 600 }}>
                  {activeRequestMusician.musician.bio ||
                    `Artist #${activeRequestMusician.musician.id}`}
                </span>
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 13 }}>Which gig is this for?</label>
                <select
                  required
                  value={requestGigId}
                  onChange={(e) => setRequestGigId(e.target.value)}
                  className={ui.input}
                >
                  <option value="">Select a gig with a stage</option>
                  {myGigs.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title} — {g.date}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 13 }}>Your offer (per gig)</label>
                <input
                  required
                  type="number"
                  min={1}
                  value={requestPrice}
                  onChange={(e) => setRequestPrice(e.target.value)}
                  className={ui.input}
                />
              </div>
              {requestError && (
                <p className={ui.error} style={{ fontSize: 13 }}>
                  {requestError}
                </p>
              )}
              {requestSuccess && (
                <p
                  className={ui.help}
                  style={{ fontSize: 13, color: "var(--accent)" }}
                >
                  {requestSuccess}
                </p>
              )}
              <div
                style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}
              >
                <Button type="submit" disabled={requestBusy}>
                  {requestBusy ? "Sending..." : "Send request"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setActiveRequestMusician(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Section>
        )}

        <Section title="Booking management">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing.md,
            }}
          >
            {bookings.map((booking) => {
              const event = events.find((e) => e.id === booking.eventId);
              const statusLabel =
                booking.status === "requested"
                  ? "Requested"
                  : booking.status === "confirmed"
                    ? "Confirmed"
                    : booking.status === "in_progress"
                      ? "In progress"
                      : booking.status === "completed"
                        ? "Completed"
                        : "Cancelled";

              return (
                <div
                  key={booking.id}
                  className={[ui.card, ui.cardPad].join(" ")}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: spacing.lg,
                  }}
                >
                  <div>
                    <h3 style={{ fontWeight: 600 }}>
                      {event?.title ?? "Event"}
                    </h3>
                    <p
                      style={{
                        marginTop: spacing.xs,
                        fontSize: 14,
                      }}
                      className={ui.help}
                    >
                      {event?.venue} · {event?.date} · {event?.time}
                    </p>
                    <p style={{ marginTop: spacing.xs, fontSize: 14 }}>
                      Status: {statusLabel} · Payout estimate $
                      {booking.payout.toFixed(0)}
                    </p>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: spacing.sm,
                      minWidth: 180,
                    }}
                  >
                    <Button fullWidth>Open conversation</Button>
                    <Button variant="ghost" fullWidth>
                      View details
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="Ratings & reviews (coming soon)">
          <p className={ui.help} style={{ fontSize: 14 }}>
            After each event you’ll be able to quickly rate musicians and
            venues, and see their history when planning your next booking.
          </p>
        </Section>
      </div>
    </AppShell>
  );
}

function BrowsePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: "http://localhost:4000/api" }),
    [],
  );

  const [query, setQuery] = useState("");
  const [city, setCity] = useState<string>("All");
  const [when, setWhen] = useState<"all" | "next_7" | "next_30">("all");

  const [gigTickets, setGigTickets] = useState<
    Record<
      string,
      {
        openForTickets: boolean;
        mode: TicketMode;
        price: number;
        currency: "USD";
      }
    >
  >(() => {
    try {
      const raw = localStorage.getItem("taa.music.gigTickets");
      if (!raw) return {};
      return JSON.parse(raw) as Record<
        string,
        {
          openForTickets: boolean;
          mode: TicketMode;
          price: number;
          currency: "USD";
        }
      >;
    } catch {
      return {};
    }
  });

  function syncGigTicketsFromStorage() {
    try {
      const raw = localStorage.getItem("taa.music.gigTickets");
      if (!raw) {
        setGigTickets({});
        return;
      }
      setGigTickets(
        JSON.parse(raw) as Record<
          string,
          {
            openForTickets: boolean;
            mode: TicketMode;
            price: number;
            currency: "USD";
          }
        >,
      );
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    // Keep browse in sync when ticketing is toggled elsewhere.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "taa.music.gigTickets") return;
      syncGigTicketsFromStorage();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", syncGigTicketsFromStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", syncGigTicketsFromStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("taa.music.gigTickets", JSON.stringify(gigTickets));
    } catch {
      // ignore
    }
  }, [gigTickets]);

  function getGigTicket(gigId: string) {
    return (
      gigTickets[gigId] ?? {
        openForTickets: false,
        mode: "general_admission" as const,
        price: 25,
        currency: "USD" as const,
      }
    );
  }

  const contentRef = React.useRef<HTMLDivElement | null>(null);

  const [results, setResults] = useState<DiscoveryResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [locations, setLocations] = useState<Location[]>([]);
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [gigsBusy, setGigsBusy] = useState(false);

  const cityOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        gigs
          .map((g) => g.location?.city)
          .filter(
            (v): v is string => typeof v === "string" && v.trim().length > 0,
          ),
      ),
    ).sort((a, b) => a.localeCompare(b));
    return ["All", ...values];
  }, [gigs]);

  const filteredGigs = useMemo(() => {
    const q = query.trim().toLowerCase();

    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const maxDays = when === "next_7" ? 7 : when === "next_30" ? 30 : null;
    const cutoff =
      maxDays === null
        ? null
        : new Date(
            todayStart.getFullYear(),
            todayStart.getMonth(),
            todayStart.getDate() + maxDays,
            23,
            59,
            59,
            999,
          );

    function matchesText(g: Gig): boolean {
      if (!q) return true;
      const haystack = [
        g.title,
        g.description ?? "",
        g.location?.name ?? "",
        g.location?.city ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    }

    function matchesCity(g: Gig): boolean {
      if (city === "All") return true;
      return (g.location?.city ?? "") === city;
    }

    function matchesWhen(g: Gig): boolean {
      if (!cutoff) return true;
      const d = new Date(`${g.date}T00:00:00`);
      if (Number.isNaN(d.getTime())) return true;
      return d >= todayStart && d <= cutoff;
    }

    return gigs
      .filter((g) => g.status !== "cancelled")
      .filter(matchesText)
      .filter(matchesCity)
      .filter(matchesWhen)
      .slice()
      .sort((a, b) => {
        const da = new Date(`${a.date}T00:00:00`).getTime();
        const db = new Date(`${b.date}T00:00:00`).getTime();
        if (Number.isNaN(da) || Number.isNaN(db)) return 0;
        return da - db;
      });
  }, [gigs, query, city, when]);

  function apiImageUrl(pathname?: string): string | undefined {
    if (!pathname) return undefined;
    if (/^https?:\/\//i.test(pathname)) return pathname;
    return `http://localhost:4000${pathname}`;
  }

  useScrollReveal(contentRef, [results?.length ?? 0, loading]);

  useEffect(() => {
    setError(null);
    setLoading(true);
    api
      .musicDiscovery({})
      .then((r) => setResults(r))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {
    api
      .listPublicLocations()
      .then((l) => setLocations(l))
      .catch(() => {
        // Best-effort; browse should still work without it.
      });
  }, [api]);

  useEffect(() => {
    setGigsBusy(true);
    api
      .listPublicGigs()
      .then((g) => setGigs(g))
      .catch(() => {
        // Best-effort; concerts list should not block the page.
      })
      .finally(() => setGigsBusy(false));
  }, [api]);

  return (
    <AppShell
      title="Concerts & events"
      subtitle="Browse what’s coming up. Hosting? Post an event and book artists."
    >
      <div
        ref={contentRef}
        className={ui.stack}
        style={{ "--stack-gap": `${spacing.lg}px` } as React.CSSProperties}
      >
        <section className={ui.hero} data-reveal>
          <div>
            <p className={ui.heroKicker}>Triple A Music</p>
            <h2 className={ui.heroTitle}>Browse upcoming concerts.</h2>
            <p className={ui.heroLead}>
              A clean, public listing of what’s happening — with host tools
              available when you’re ready to post and book.
            </p>

            <div className={ui.heroActions}>
              <Button
                onClick={() =>
                  document
                    .getElementById("music-concerts")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                Browse concerts
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  if (!user) {
                    navigate(`/login?next=${encodeURIComponent("/post-gig")}`);
                    return;
                  }
                  navigate("/post-gig");
                }}
              >
                Post an event
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  document
                    .getElementById("music-performers")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                Browse performers
              </Button>
              {!user ? (
                <Button variant="ghost" onClick={() => navigate("/login")}>
                  Sign in
                </Button>
              ) : null}
            </div>
          </div>

          <div className={ui.featureGrid}>
            <div className={ui.featureCard} data-reveal>
              <p className={ui.featureTitle}>Real listings</p>
              <p className={ui.featureBody}>
                See upcoming events and what’s open right now.
              </p>
            </div>
            <div className={ui.featureCard} data-reveal>
              <p className={ui.featureTitle}>Host tools</p>
              <p className={ui.featureBody}>
                Post an event, review applicants, and confirm bookings.
              </p>
            </div>
            <div className={ui.featureCard} data-reveal>
              <p className={ui.featureTitle}>Messaging</p>
              <p className={ui.featureBody}>
                Keep communication in one thread — customers, musicians, venues,
                support.
              </p>
            </div>
          </div>
        </section>

        <div id="music-concerts" />

        <Section title="Upcoming concerts">
          {gigsBusy ? <p className={ui.help}>Loading concerts…</p> : null}
          {!gigsBusy && gigs.length === 0 ? (
            <p className={ui.help}>No upcoming events yet.</p>
          ) : (
            <div
              className={ui.stack}
              style={{ "--stack-gap": "12px" } as React.CSSProperties}
            >
              <div
                className={ui.scroller}
                style={{ "--scroller-gap": "8px" } as React.CSSProperties}
              >
                <Button
                  variant={when === "all" ? "secondary" : "ghost"}
                  onClick={() => setWhen("all")}
                >
                  Any date
                </Button>
                <Button
                  variant={when === "next_7" ? "secondary" : "ghost"}
                  onClick={() => setWhen("next_7")}
                >
                  Next 7 days
                </Button>
                <Button
                  variant={when === "next_30" ? "secondary" : "ghost"}
                  onClick={() => setWhen("next_30")}
                >
                  Next 30 days
                </Button>
              </div>

              <div className={ui.rowBetween} style={{ alignItems: "flex-end" }}>
                <div
                  className={ui.stack}
                  style={
                    { "--stack-gap": "6px", minWidth: 0 } as React.CSSProperties
                  }
                >
                  <label className={ui.help} style={{ fontSize: 13 }}>
                    Search
                  </label>
                  <input
                    className={ui.input}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Artist, venue, city…"
                  />
                </div>

                <div
                  className={ui.stack}
                  style={
                    { "--stack-gap": "6px", width: 220 } as React.CSSProperties
                  }
                >
                  <label className={ui.help} style={{ fontSize: 13 }}>
                    City
                  </label>
                  <select
                    className={ui.input}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  >
                    {cityOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className={ui.help} style={{ margin: 0, fontSize: 13 }}>
                Showing <strong>{filteredGigs.length}</strong> event
                {filteredGigs.length === 1 ? "" : "s"}
              </p>

              <div
                className={[ui.grid, ui.gridCards].join(" ")}
                style={{ "--grid-gap": "16px" } as React.CSSProperties}
              >
                {filteredGigs.slice(0, 24).map((g) => {
                  const t = getGigTicket(g.id);
                  return (
                    <div
                      key={g.id}
                      className={[ui.card, ui.cardPad, ui.stack].join(" ")}
                      data-reveal
                      style={{ "--stack-gap": "12px" } as React.CSSProperties}
                    >
                      <div className={[ui.media, ui.mediaWide].join(" ")}>
                        {g.location?.imageUrl ? (
                          <img
                            src={apiImageUrl(g.location.imageUrl)}
                            alt={g.location.name}
                            loading="lazy"
                          />
                        ) : (
                          <div className={ui.mediaPlaceholder}>Event</div>
                        )}
                      </div>

                      <div>
                        <p className={ui.cardTitle}>{g.title}</p>
                        <p className={ui.cardText} style={{ marginTop: 6 }}>
                          {g.date}
                          {g.time ? ` · ${g.time}` : ""}
                          {g.location?.name ? ` · ${g.location.name}` : ""}
                          {g.location?.city ? ` · ${g.location.city}` : ""}
                        </p>
                      </div>

                      <div className={ui.rowBetween}>
                        <div className={ui.chipBar}>
                          <span className={ui.chip}>{g.status}</span>
                          <span className={ui.chip}>
                            {t.openForTickets ? "Tickets" : "No tickets"}
                          </span>
                        </div>
                        <p
                          className={ui.help}
                          style={{ margin: 0, fontSize: 13 }}
                        >
                          {t.openForTickets ? `From ${formatUsd(t.price)}` : ""}
                        </p>
                      </div>

                      <div
                        className={ui.row}
                        style={{ "--row-gap": "10px" } as React.CSSProperties}
                      >
                        <Button
                          variant="secondary"
                          onClick={() =>
                            navigate(`/gigs/${encodeURIComponent(g.id)}`)
                          }
                        >
                          View
                        </Button>
                        <Button
                          disabled={!t.openForTickets}
                          onClick={() =>
                            navigate(
                              `/gigs/${encodeURIComponent(g.id)}/tickets`,
                            )
                          }
                        >
                          {t.openForTickets ? "Buy tickets" : "Tickets soon"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Section>

        <div id="music-performers" />

        <Section title="Featured stages">
          <div className={ui.scroller}>
            {locations.slice(0, 10).map((loc) => (
              <div
                key={loc.id}
                data-reveal
                className={[ui.card, ui.cardPad, ui.stack].join(" ")}
                style={
                  {
                    "--stack-gap": "10px",
                    minWidth: 260,
                  } as React.CSSProperties
                }
              >
                <div className={[ui.media, ui.mediaWide].join(" ")}>
                  {loc.imageUrl ? (
                    <img
                      src={apiImageUrl(loc.imageUrl)}
                      alt={loc.name}
                      loading="lazy"
                    />
                  ) : (
                    <div className={ui.mediaPlaceholder}>Stage</div>
                  )}
                </div>
                <p className={ui.cardTitle}>{loc.name}</p>
                <p className={ui.cardText}>
                  {[loc.city, loc.address].filter(Boolean).join(" · ") ||
                    "Stage"}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Available performers">
          {loading ? (
            <p className={ui.help} style={{ fontSize: 14, margin: 0 }}>
              Loading...
            </p>
          ) : error ? (
            <p className={ui.error} style={{ margin: 0 }}>
              {error}
            </p>
          ) : null}

          <div
            className={[ui.grid, ui.gridCards].join(" ")}
            style={{ "--grid-gap": `${spacing.lg}px` } as React.CSSProperties}
          >
            {(results ?? []).map((r) => {
              const detailsPath = `/musicians/${encodeURIComponent(
                r.musician.id,
              )}`;
              return (
                <div
                  key={r.musician.id}
                  data-reveal
                  className={[ui.card, ui.cardPad, ui.stack].join(" ")}
                  style={
                    { "--stack-gap": `${spacing.sm}px` } as React.CSSProperties
                  }
                >
                  <div className={ui.chipBar}>
                    {r.musician.instruments.map((i) => (
                      <Chip key={i} label={i} />
                    ))}
                    {r.musician.genres.map((g) => (
                      <Chip key={g} label={g} />
                    ))}
                  </div>

                  <p className={ui.cardTitle}>
                    {r.musician.instruments.join(" / ")}
                  </p>
                  <p className={ui.cardText}>{r.musician.bio}</p>

                  <div className={ui.rowBetween}>
                    <p className={ui.help} style={{ margin: 0, fontSize: 13 }}>
                      {r.musician.averageRating.toFixed(1)}★ (
                      {r.musician.reviewCount})
                    </p>
                    <p className={ui.help} style={{ margin: 0, fontSize: 13 }}>
                      ~${r.priceEstimate} · {r.distanceMinutes} min
                    </p>
                  </div>

                  <div
                    className={ui.row}
                    style={
                      { "--row-gap": `${spacing.sm}px` } as React.CSSProperties
                    }
                  >
                    <Button
                      variant="secondary"
                      onClick={() => navigate(detailsPath)}
                    >
                      View
                    </Button>
                    <Button
                      onClick={() => {
                        const target = `${detailsPath}?book=1`;
                        if (!user) {
                          navigate(`/login?next=${encodeURIComponent(target)}`);
                          return;
                        }
                        navigate(target);
                      }}
                    >
                      Book
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="How booking works">
          <p className={ui.help} style={{ fontSize: 14, margin: 0 }}>
            Browse performers, view details, then sign in to request and manage
            bookings.
          </p>
        </Section>
      </div>
    </AppShell>
  );
}

function PublicGigDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: "http://localhost:4000/api" }),
    [],
  );

  const [gig, setGig] = useState<Gig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [gigTickets, setGigTickets] = useState<
    Record<
      string,
      {
        openForTickets: boolean;
        mode: TicketMode;
        price: number;
        currency: "USD";
      }
    >
  >(() => {
    try {
      const raw = localStorage.getItem("taa.music.gigTickets");
      if (!raw) return {};
      return JSON.parse(raw) as Record<
        string,
        {
          openForTickets: boolean;
          mode: TicketMode;
          price: number;
          currency: "USD";
        }
      >;
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("taa.music.gigTickets", JSON.stringify(gigTickets));
    } catch {
      // ignore
    }
  }, [gigTickets]);

  function getGigTicket(gigId: string) {
    return (
      gigTickets[gigId] ?? {
        openForTickets: false,
        mode: "general_admission" as const,
        price: 25,
        currency: "USD" as const,
      }
    );
  }

  function apiImageUrl(pathname?: string): string | undefined {
    if (!pathname) return undefined;
    if (/^https?:\/\//i.test(pathname)) return pathname;
    return `http://localhost:4000${pathname}`;
  }

  useEffect(() => {
    if (!id) return;
    setError(null);
    setLoading(true);
    api
      .getPublicGig(id)
      .then((g) => setGig(g))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [api, id]);

  if (loading) {
    return (
      <AppShell title="Event" subtitle="Loading…">
        <p className={ui.help}>Loading…</p>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Event" subtitle="Error">
        <div
          className={ui.stack}
          style={{ "--stack-gap": "12px" } as React.CSSProperties}
        >
          <p className={ui.error} style={{ margin: 0 }}>
            {error}
          </p>
          <Button variant="secondary" onClick={() => navigate("/")}>
            Back to concerts
          </Button>
        </div>
      </AppShell>
    );
  }

  if (!gig) {
    return (
      <AppShell title="Event" subtitle="Not found">
        <div
          className={ui.stack}
          style={{ "--stack-gap": "12px" } as React.CSSProperties}
        >
          <p className={ui.help} style={{ margin: 0 }}>
            This event isn’t available.
          </p>
          <Button variant="secondary" onClick={() => navigate("/")}>
            Back to concerts
          </Button>
        </div>
      </AppShell>
    );
  }

  const subtitleParts = [
    gig.date,
    gig.time ? gig.time : null,
    gig.location?.name ? gig.location.name : null,
  ].filter(Boolean);

  const t = id ? getGigTicket(id) : null;

  return (
    <AppShell title={gig.title} subtitle={subtitleParts.join(" · ")}>
      <div
        className={ui.stack}
        style={{ "--stack-gap": "16px" } as React.CSSProperties}
      >
        <div
          className={[ui.card, ui.cardPad, ui.stack].join(" ")}
          style={{ "--stack-gap": "12px" } as React.CSSProperties}
        >
          <div className={[ui.media, ui.mediaWide].join(" ")}>
            {gig.location?.imageUrl ? (
              <img
                src={apiImageUrl(gig.location.imageUrl)}
                alt={gig.location?.name ?? "Event"}
                loading="lazy"
              />
            ) : (
              <div className={ui.mediaPlaceholder}>Event</div>
            )}
          </div>

          <div className={ui.rowBetween}>
            <span className={ui.chip}>{gig.status}</span>
            {typeof gig.budget === "number" ? (
              <p className={ui.help} style={{ margin: 0, fontSize: 13 }}>
                Host budget: ${gig.budget.toFixed(0)}
              </p>
            ) : null}
          </div>

          {gig.description ? (
            <p className={ui.cardText}>{gig.description}</p>
          ) : null}

          <div className={ui.divider} />

          <div
            className={[ui.stack].join(" ")}
            style={{ "--stack-gap": "10px" } as React.CSSProperties}
          >
            <div className={ui.rowBetween}>
              <div>
                <p className={ui.cardTitle}>Tickets</p>
                <p className={ui.help} style={{ margin: 0, fontSize: 13 }}>
                  Inventory is derived from venue capacity.
                </p>
              </div>
              <span className={ui.chip}>
                {t?.openForTickets ? "On sale" : "Not on sale"}
              </span>
            </div>

            <div className={ui.rowBetween}>
              <p className={ui.help} style={{ margin: 0, fontSize: 13 }}>
                Mode
              </p>
              <p className={ui.help} style={{ margin: 0, fontSize: 13 }}>
                {t?.mode === "assigned_seating"
                  ? "Assigned seating"
                  : "General admission"}
              </p>
            </div>

            <div className={ui.rowBetween}>
              <p className={ui.help} style={{ margin: 0, fontSize: 13 }}>
                Starting at
              </p>
              <p className={ui.help} style={{ margin: 0, fontSize: 13 }}>
                {t?.openForTickets ? formatUsd(t?.price ?? 0) : "—"}
              </p>
            </div>

            <div
              className={ui.row}
              style={{ "--row-gap": "10px" } as React.CSSProperties}
            >
              <Button
                disabled={!t?.openForTickets}
                onClick={() =>
                  navigate(`/gigs/${encodeURIComponent(id ?? "")}/tickets`)
                }
              >
                {t?.openForTickets ? "Buy tickets" : "Tickets soon"}
              </Button>
              {user?.role.includes("customer") && id ? (
                <Button
                  variant="secondary"
                  onClick={() =>
                    setGigTickets((prev) => ({
                      ...prev,
                      [id]: { ...getGigTicket(id), openForTickets: true },
                    }))
                  }
                >
                  Enable ticketing
                </Button>
              ) : null}
            </div>
          </div>

          <div
            className={ui.row}
            style={{ "--row-gap": "10px" } as React.CSSProperties}
          >
            <Button variant="ghost" onClick={() => navigate("/")}>
              Back
            </Button>
            <Button
              onClick={() => {
                if (!user) {
                  navigate(`/login?next=${encodeURIComponent("/post-gig")}`);
                  return;
                }
                navigate("/post-gig");
              }}
            >
              Host an event
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function PublicTicketsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: "http://localhost:4000/api" }),
    [],
  );

  const [gig, setGig] = useState<Gig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState<number>(2);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutDone, setCheckoutDone] = useState<TicketOrder | null>(null);

  const [gigTickets, setGigTickets] = useState<
    Record<
      string,
      {
        openForTickets: boolean;
        mode: TicketMode;
        price: number;
        currency: "USD";
      }
    >
  >(() => {
    try {
      const raw = localStorage.getItem("taa.music.gigTickets");
      if (!raw) return {};
      return JSON.parse(raw) as Record<
        string,
        {
          openForTickets: boolean;
          mode: TicketMode;
          price: number;
          currency: "USD";
        }
      >;
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("taa.music.gigTickets", JSON.stringify(gigTickets));
    } catch {
      // ignore
    }
  }, [gigTickets]);

  function getGigTicket(gigId: string) {
    return (
      gigTickets[gigId] ?? {
        openForTickets: false,
        mode: "general_admission" as const,
        price: 25,
        currency: "USD" as const,
      }
    );
  }

  useEffect(() => {
    if (!id) return;
    setError(null);
    setLoading(true);
    api
      .getPublicGig(id)
      .then((g) => setGig(g))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [api, id]);

  if (loading) {
    return (
      <AppShell title="Tickets" subtitle="Loading…">
        <p className={ui.help}>Loading…</p>
      </AppShell>
    );
  }

  if (error || !gig || !id) {
    return (
      <AppShell title="Tickets" subtitle="Unavailable">
        <div
          className={ui.stack}
          style={{ "--stack-gap": "12px" } as React.CSSProperties}
        >
          <p className={ui.help} style={{ margin: 0 }}>
            {error ? error : "Tickets aren’t available for this event."}
          </p>
          <Button variant="secondary" onClick={() => navigate("/")}>
            Back to concerts
          </Button>
        </div>
      </AppShell>
    );
  }

  const t = getGigTicket(id);
  const subtotal = (t.price ?? 0) * Math.max(1, Math.min(10, qty));
  const platformFee = Math.round(subtotal * 0.05);
  const total = subtotal + platformFee;

  async function checkout() {
    if (!id) return;
    if (!t.openForTickets) return;
    setCheckoutBusy(true);
    try {
      const quantity = Math.max(1, Math.min(10, qty));
      const order: TicketOrder = {
        id: randomId("ord"),
        gigId: id,
        quantity,
        unitPrice: t.price,
        platformFee,
        total,
        currency: "USD",
        purchasedAt: new Date().toISOString(),
        status: "confirmed",
        accessCode: randomId("taa").toUpperCase(),
      };

      const existing = loadTicketOrders();
      saveTicketOrders([order, ...existing]);
      setCheckoutDone(order);
    } finally {
      setCheckoutBusy(false);
    }
  }

  return (
    <AppShell title="Tickets" subtitle={gig.title}>
      <div
        className={ui.stack}
        style={{ "--stack-gap": "16px" } as React.CSSProperties}
      >
        <div
          className={[ui.card, ui.cardPad, ui.stack].join(" ")}
          style={{ "--stack-gap": "12px" } as React.CSSProperties}
        >
          <div className={ui.rowBetween}>
            <div>
              <p className={ui.cardTitle}>Purchase</p>
              <p className={ui.cardText} style={{ marginTop: 6 }}>
                {gig.date}
                {gig.time ? ` · ${gig.time}` : ""}
                {gig.location?.name ? ` · ${gig.location.name}` : ""}
              </p>
            </div>
            <span className={ui.chip}>
              {t.mode === "assigned_seating" ? "Assigned" : "GA"}
            </span>
          </div>

          {!t.openForTickets ? (
            <div className={ui.empty}>
              Tickets aren’t on sale yet.
              <div
                className={ui.row}
                style={
                  { "--row-gap": "10px", marginTop: 12 } as React.CSSProperties
                }
              >
                <Button
                  variant="ghost"
                  onClick={() => navigate(`/gigs/${encodeURIComponent(id)}`)}
                >
                  Back to event
                </Button>
                {user?.role.includes("customer") ? (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setGigTickets((prev) => ({
                        ...prev,
                        [id]: { ...getGigTicket(id), openForTickets: true },
                      }))
                    }
                  >
                    Enable ticketing
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <div className={ui.divider} />

              <div className={ui.rowBetween}>
                <div
                  className={ui.stack}
                  style={{ "--stack-gap": "4px" } as React.CSSProperties}
                >
                  <p style={{ fontWeight: 650, fontSize: 13 }}>Quantity</p>
                  <p className={ui.help} style={{ margin: 0, fontSize: 13 }}>
                    Capacity comes from the venue.
                  </p>
                </div>
                <div
                  className={ui.row}
                  style={{ "--row-gap": "8px" } as React.CSSProperties}
                >
                  <Button
                    variant="ghost"
                    onClick={() => setQty((n) => Math.max(1, n - 1))}
                  >
                    −
                  </Button>
                  <input
                    className={ui.input}
                    style={{ width: 80, textAlign: "center" }}
                    inputMode="numeric"
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value) || 1)}
                  />
                  <Button
                    variant="ghost"
                    onClick={() => setQty((n) => Math.min(10, n + 1))}
                  >
                    +
                  </Button>
                </div>
              </div>

              {t.mode === "assigned_seating" ? (
                <div className={ui.empty}>
                  Seat map UI goes here (layout required).
                </div>
              ) : null}

              <div className={ui.divider} />

              <div
                className={ui.stack}
                style={{ "--stack-gap": "8px" } as React.CSSProperties}
              >
                <div className={ui.rowBetween}>
                  <p className={ui.help} style={{ margin: 0, fontSize: 13 }}>
                    Tickets ({Math.max(1, Math.min(10, qty))} ×{" "}
                    {formatUsd(t.price)})
                  </p>
                  <p className={ui.help} style={{ margin: 0, fontSize: 13 }}>
                    {formatUsd(subtotal)}
                  </p>
                </div>
                <div className={ui.rowBetween}>
                  <p className={ui.help} style={{ margin: 0, fontSize: 13 }}>
                    Platform fee
                  </p>
                  <p className={ui.help} style={{ margin: 0, fontSize: 13 }}>
                    {formatUsd(platformFee)}
                  </p>
                </div>
                <div className={ui.rowBetween}>
                  <p style={{ margin: 0, fontWeight: 650, fontSize: 13 }}>
                    Total
                  </p>
                  <p style={{ margin: 0, fontWeight: 650, fontSize: 13 }}>
                    {formatUsd(total)}
                  </p>
                </div>
              </div>

              <div
                className={ui.row}
                style={{ "--row-gap": "10px" } as React.CSSProperties}
              >
                <Button
                  variant="ghost"
                  onClick={() => navigate(`/gigs/${encodeURIComponent(id)}`)}
                >
                  Back to event
                </Button>
                {checkoutDone ? (
                  <Button
                    variant="secondary"
                    onClick={() => navigate("/my-tickets")}
                  >
                    View my tickets
                  </Button>
                ) : (
                  <Button onClick={checkout} disabled={checkoutBusy}>
                    {checkoutBusy ? "Processing…" : "Checkout"}
                  </Button>
                )}
              </div>

              {checkoutDone ? (
                <div className={ui.empty}>
                  Purchase confirmed. Your ticket is ready in My Tickets.
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function MyTicketsPage() {
  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: "http://localhost:4000/api" }),
    [],
  );
  const { user } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<TicketOrder[]>(() => loadTicketOrders());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gigsById, setGigsById] = useState<Record<string, Gig | null>>({});
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  useEffect(() => {
    // Keep in sync across tabs/refreshes.
    const interval = window.setInterval(() => {
      setOrders(loadTicketOrders());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const uniqueGigIds = Array.from(new Set(orders.map((o) => o.gigId)));
    const missing = uniqueGigIds.filter((gid) => !(gid in gigsById));
    if (missing.length === 0) return;

    let cancelled = false;
    Promise.all(
      missing.map((gid) =>
        api
          .getPublicGig(gid)
          .then((g) => ({ gid, g }))
          .catch(() => ({ gid, g: null })),
      ),
    ).then((pairs) => {
      if (cancelled) return;
      setGigsById((prev) => {
        const next = { ...prev };
        for (const p of pairs) next[p.gid] = p.g;
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [api, orders, gigsById]);

  const selected = selectedId
    ? (orders.find((o) => o.id === selectedId) ?? null)
    : null;

  const now = new Date();
  const visible = orders
    .filter((o) => o.status === "confirmed")
    .filter((o) => {
      const g = gigsById[o.gigId];
      if (!g) return tab === "upcoming";
      const d = new Date(`${g.date}T00:00:00`);
      if (Number.isNaN(d.getTime())) return tab === "upcoming";
      return tab === "upcoming" ? d >= now : d < now;
    });

  if (!user) {
    return (
      <AppShell title="My tickets" subtitle="Sign in to view your purchases.">
        <div
          className={ui.stack}
          style={{ "--stack-gap": "12px" } as React.CSSProperties}
        >
          <p className={ui.help} style={{ margin: 0 }}>
            Your ticket wallet appears here after checkout.
          </p>
          <Button
            variant="secondary"
            onClick={() => navigate("/login?next=/my-tickets")}
          >
            Sign in
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="My tickets" subtitle="Your wallet for upcoming events.">
      <div
        className={ui.stack}
        style={{ "--stack-gap": "14px" } as React.CSSProperties}
      >
        <div
          className={ui.scroller}
          style={{ "--scroller-gap": "8px" } as React.CSSProperties}
        >
          <Button
            variant={tab === "upcoming" ? "secondary" : "ghost"}
            onClick={() => setTab("upcoming")}
          >
            Upcoming
          </Button>
          <Button
            variant={tab === "past" ? "secondary" : "ghost"}
            onClick={() => setTab("past")}
          >
            Past
          </Button>
        </div>

        {visible.length === 0 ? (
          <div className={ui.empty}>
            No tickets yet. Browse concerts and checkout when tickets are on
            sale.
          </div>
        ) : (
          <div
            className={[ui.grid, ui.gridCards].join(" ")}
            style={{ "--grid-gap": "16px" } as React.CSSProperties}
          >
            {visible.map((o) => {
              const g = gigsById[o.gigId];
              return (
                <div
                  key={o.id}
                  className={[ui.card, ui.cardPad, ui.stack].join(" ")}
                  style={{ "--stack-gap": "12px" } as React.CSSProperties}
                >
                  <div>
                    <p className={ui.cardTitle}>{g?.title ?? "Event"}</p>
                    <p className={ui.cardText} style={{ marginTop: 6 }}>
                      {g?.date ?? ""}
                      {g?.time ? ` · ${g.time}` : ""}
                      {g?.location?.name ? ` · ${g.location.name}` : ""}
                    </p>
                  </div>

                  <div className={ui.rowBetween}>
                    <span className={ui.chip}>
                      {o.quantity} ticket{o.quantity === 1 ? "" : "s"}
                    </span>
                    <p className={ui.help} style={{ margin: 0, fontSize: 13 }}>
                      {formatUsd(o.total)}
                    </p>
                  </div>

                  <div
                    className={ui.row}
                    style={{ "--row-gap": "10px" } as React.CSSProperties}
                  >
                    <Button
                      variant="secondary"
                      onClick={() => setSelectedId(o.id)}
                    >
                      View QR
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        navigate(`/gigs/${encodeURIComponent(o.gigId)}`)
                      }
                    >
                      Event page
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selected ? (
          <div
            className={[ui.card, ui.cardPad, ui.stack].join(" ")}
            style={{ "--stack-gap": "12px" } as React.CSSProperties}
          >
            <div className={ui.rowBetween}>
              <div>
                <p className={ui.cardTitle}>Ticket access</p>
                <p className={ui.help} style={{ margin: 0, fontSize: 13 }}>
                  Access code:{" "}
                  <strong style={{ color: "var(--text)" }}>
                    {selected.accessCode}
                  </strong>
                </p>
              </div>
              <Button variant="ghost" onClick={() => setSelectedId(null)}>
                Close
              </Button>
            </div>

            <div
              className={ui.row}
              style={
                {
                  "--row-gap": "14px",
                  alignItems: "flex-start",
                } as React.CSSProperties
              }
            >
              <div
                className={[ui.media, ui.mediaSquare].join(" ")}
                style={{ width: 220, height: 220 } as React.CSSProperties}
              >
                <div className={ui.mediaPlaceholder}>QR</div>
              </div>

              <div
                className={ui.stack}
                style={
                  {
                    "--stack-gap": "10px",
                    minWidth: 0,
                    flex: 1,
                  } as React.CSSProperties
                }
              >
                <div className={ui.empty}>
                  Ticket wallet. QR rendering and gate validation will appear
                  here.
                </div>

                <div
                  className={ui.row}
                  style={{ "--row-gap": "10px" } as React.CSSProperties}
                >
                  <Button variant="secondary" disabled>
                    Transfer
                  </Button>
                  <Button variant="ghost" disabled>
                    Request refund
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function MusicianDetailsPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: "http://localhost:4000/api" }),
    [],
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [musician, setMusician] = useState<MusicianProfile | null>(null);

  useEffect(() => {
    if (!id) return;
    setError(null);
    setLoading(true);
    api
      .getPublicMusician(id)
      .then((m) => setMusician(m))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [api, id]);

  if (loading) {
    return (
      <AppShell title="Musician" subtitle="Loading...">
        <p className={ui.help} style={{ fontSize: 14 }}>
          Loading details...
        </p>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Musician" subtitle="Error">
        <p className={ui.error}>{error}</p>
        <Button variant="secondary" onClick={() => navigate("/")}>
          Back to browse
        </Button>
      </AppShell>
    );
  }

  if (!musician) {
    return (
      <AppShell title="Musician" subtitle="Not found">
        <p className={ui.help} style={{ fontSize: 14 }}>
          This performer could not be found.
        </p>
        <Button variant="secondary" onClick={() => navigate("/")}>
          Back to browse
        </Button>
      </AppShell>
    );
  }

  const wantsBooking = searchParams.get("book") === "1";
  const isCustomer = !!user?.role.includes("customer");

  useEffect(() => {
    if (!wantsBooking) return;
    if (user) return;

    const next = `${location.pathname}${location.search}`;
    navigate(`/login?next=${encodeURIComponent(next)}`);
  }, [wantsBooking, user, location.pathname, location.search, navigate]);

  const [selectedEventId, setSelectedEventId] = useState<string>(
    events[0]?.id ?? "new",
  );
  const [newEventName, setNewEventName] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventTime, setNewEventTime] = useState("");
  const [newEventVenue, setNewEventVenue] = useState("");
  const [budget, setBudget] = useState<string>("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null;
  const isNewEvent = selectedEventId === "new";

  return (
    <AppShell
      title="Performer details"
      subtitle="Review pricing, ratings, and availability."
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing.lg,
          maxWidth: 780,
        }}
      >
        <div
          className={[ui.card, ui.cardPad].join(" ")}
          style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}
        >
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            {musician.instruments.map((i) => (
              <Chip key={i} label={i} />
            ))}
            {musician.genres.map((g) => (
              <Chip key={g} label={g} />
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
            {musician.instruments.join(" / ")}
          </p>
          <p className={ui.help} style={{ margin: 0, fontSize: 14 }}>
            {musician.bio}
          </p>
          <p className={ui.help} style={{ margin: 0, fontSize: 13 }}>
            {musician.averageRating.toFixed(1)}★ ({musician.reviewCount}{" "}
            reviews)
          </p>

          <div
            style={{
              display: "flex",
              gap: spacing.sm,
              marginTop: spacing.sm,
              flexWrap: "wrap",
            }}
          >
            <Button variant="secondary" onClick={() => navigate("/")}>
              Back
            </Button>
            <Button
              onClick={() => {
                const target = `/musicians/${encodeURIComponent(
                  musician.id,
                )}?book=1`;
                if (!user) {
                  navigate(`/login?next=${encodeURIComponent(target)}`);
                  return;
                }
                navigate(target);
              }}
            >
              {user ? "Start booking" : "Sign in to book"}
            </Button>
          </div>
        </div>

        {wantsBooking ? (
          <div className={[ui.card, ui.cardPad].join(" ")}>
            {!user ? (
              <p className={ui.help} style={{ margin: 0, fontSize: 14 }}>
                Sign in to request a booking.
              </p>
            ) : !isCustomer ? (
              <p className={ui.help} style={{ margin: 0, fontSize: 14 }}>
                This action is available in the customer role.
              </p>
            ) : (
              <>
                <p style={{ margin: 0, fontWeight: 600 }}>Request a booking</p>
                <p
                  style={{
                    marginTop: spacing.xs,
                    fontSize: 14,
                  }}
                  className={ui.help}
                >
                  Choose an existing event or create a new one, then submit your
                  request.
                </p>

                {submitError ? (
                  <p className={ui.error} style={{ margin: 0 }}>
                    {submitError}
                  </p>
                ) : null}

                {submitted ? (
                  <div
                    className={ui.card}
                    style={{
                      marginTop: spacing.md,
                      padding: spacing.md,
                      fontSize: 14,
                    }}
                  >
                    Request submitted. You’ll see status updates here.
                  </div>
                ) : (
                  <div
                    style={{
                      marginTop: spacing.md,
                      display: "flex",
                      flexDirection: "column",
                      gap: spacing.md,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <label style={{ fontSize: 13 }}>Event</label>
                      <select
                        value={selectedEventId}
                        onChange={(e) => setSelectedEventId(e.target.value)}
                        className={ui.input}
                      >
                        {events.map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            {ev.title}
                          </option>
                        ))}
                        <option value="new">New event…</option>
                      </select>
                    </div>

                    {isNewEvent ? (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: spacing.md,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          <label style={{ fontSize: 13 }}>Event name</label>
                          <input
                            value={newEventName}
                            onChange={(e) => setNewEventName(e.target.value)}
                            placeholder="Birthday party, wedding, corporate…"
                            className={ui.input}
                          />
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          <label style={{ fontSize: 13 }}>Date</label>
                          <input
                            type="date"
                            value={newEventDate}
                            onChange={(e) => setNewEventDate(e.target.value)}
                            className={ui.input}
                          />
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          <label style={{ fontSize: 13 }}>Start time</label>
                          <input
                            type="time"
                            value={newEventTime}
                            onChange={(e) => setNewEventTime(e.target.value)}
                            className={ui.input}
                          />
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          <label style={{ fontSize: 13 }}>
                            Venue / address
                          </label>
                          <input
                            value={newEventVenue}
                            onChange={(e) => setNewEventVenue(e.target.value)}
                            placeholder="Venue name or address"
                            className={ui.input}
                          />
                        </div>
                      </div>
                    ) : selectedEvent ? (
                      <div
                        className={[ui.card, ui.cardPad, ui.help].join(" ")}
                        style={{ padding: spacing.md, fontSize: 14 }}
                      >
                        Using event:{" "}
                        <strong style={{ color: "var(--text)" }}>
                          {selectedEvent.title}
                        </strong>
                      </div>
                    ) : null}

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: spacing.md,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <label style={{ fontSize: 13 }}>Budget (USD)</label>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={budget}
                          onChange={(e) => setBudget(e.target.value)}
                          placeholder="500"
                          className={ui.input}
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <label style={{ fontSize: 13 }}>Special requests</label>
                        <input
                          value={specialRequests}
                          onChange={(e) => setSpecialRequests(e.target.value)}
                          placeholder="Dress code, set list, sound needs…"
                          className={ui.input}
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: spacing.sm,
                        flexWrap: "wrap",
                      }}
                    >
                      <Button
                        onClick={() => {
                          setSubmitError(null);

                          const resolvedBudget = budget ? Number(budget) : 500;
                          if (
                            !Number.isFinite(resolvedBudget) ||
                            resolvedBudget <= 0
                          ) {
                            setSubmitError("Please enter a valid budget.");
                            return;
                          }

                          if (isNewEvent) {
                            if (!newEventName.trim() || !newEventDate) {
                              setSubmitError(
                                "Please provide an event name and date.",
                              );
                              return;
                            }
                          }

                          setSubmitted(true);
                        }}
                      >
                        Submit request
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSubmitted(false);
                          setSubmitError(null);
                          setBudget("");
                          setSpecialRequests("");
                          setNewEventName("");
                          setNewEventDate("");
                          setNewEventTime("");
                          setNewEventVenue("");
                          setSelectedEventId(events[0]?.id ?? "new");
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function EventsPage() {
  return (
    <AppShell
      title="Operations"
      subtitle="Bookings, comms, and ticket settings — run the event cleanly."
    >
      <div
        className={ui.stack}
        style={{ "--stack-gap": "16px" } as React.CSSProperties}
      >
        <div className={ui.empty}>
          This is the host operations hub. Next up: per-event timelines,
          staffing notes, and a public ticket link when ticketing is enabled.
        </div>

        <Section title="Upcoming">
          <div className={[ui.grid, ui.gridCards].join(" ")}>
            {events.map((e) => (
              <div
                key={e.id}
                className={[ui.card, ui.cardPad, ui.stack].join(" ")}
                style={{ "--stack-gap": "12px" } as React.CSSProperties}
              >
                <div>
                  <p className={ui.cardTitle}>{e.title}</p>
                  <p className={ui.cardText}>
                    {e.date} · {e.time} · {e.venue}
                  </p>
                </div>

                <div className={ui.rowBetween}>
                  <span className={ui.chip}>Booking</span>
                  <Button
                    variant="secondary"
                    onClick={() => (window.location.href = "/tickets")}
                  >
                    Tickets
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </AppShell>
  );
}

function PostGigPage() {
  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: "http://localhost:4000/api" }),
    [],
  );
  const { user } = useAuth();
  const navigate = useNavigate();

  const isCustomer = !!user?.role.includes("customer");

  const [locations, setLocations] = useState<
    Array<{ id: string; name: string; city?: string }>
  >([]);
  const [locationsBusy, setLocationsBusy] = useState(false);
  const [locationsError, setLocationsError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [budget, setBudget] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");
  const [details, setDetails] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  useEffect(() => {
    setLocationsError(null);
    setLocationsBusy(true);
    api
      .listPublicLocations()
      .then((locs) => {
        const simplified = locs.map((l) => ({
          id: l.id,
          name: l.name,
          city: l.city,
        }));
        setLocations(simplified);
        if (!locationId && simplified[0]) setLocationId(simplified[0].id);
      })
      .catch((e) =>
        setLocationsError(e instanceof Error ? e.message : String(e)),
      )
      .finally(() => setLocationsBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  return (
    <AppShell
      title="Post a gig"
      subtitle="Create an event listing so musicians can see it."
    >
      {!isCustomer ? (
        <p className={ui.help} style={{ margin: 0, fontSize: 14 }}>
          Posting gigs is available for customer accounts.
        </p>
      ) : null}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing.lg,
          maxWidth: 720,
        }}
      >
        {submittedId ? (
          <div
            className={[ui.card, ui.cardPad, ui.help].join(" ")}
            style={{ fontSize: 14 }}
          >
            Gig posted. ID: {submittedId}
            <div style={{ marginTop: spacing.sm }}>
              <Button variant="secondary" onClick={() => navigate("/")}>
                Back to browse
              </Button>
              <Button
                style={{ marginLeft: spacing.sm }}
                onClick={() => navigate(`/gigs/${submittedId}/applicants`)}
              >
                Review applicants
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={[ui.card, ui.cardPad].join(" ")}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing.md,
            }}
          >
            {locationsError ? (
              <p className={ui.error}>{locationsError}</p>
            ) : null}
            {error ? <p className={ui.error}>{error}</p> : null}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: spacing.md,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 13 }}>Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Jazz trio for dinner, DJ for birthday…"
                  disabled={!isCustomer}
                  className={ui.input}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 13 }}>Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={!isCustomer}
                  className={ui.input}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 13 }}>Start time (optional)</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  disabled={!isCustomer}
                  className={ui.input}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 13 }}>Budget (USD, optional)</label>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="600"
                  disabled={!isCustomer}
                  className={ui.input}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 13 }}>Location</label>
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  disabled={
                    !isCustomer || locationsBusy || locations.length === 0
                  }
                  className={ui.input}
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                      {l.city ? ` · ${l.city}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13 }}>Details (optional)</label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Duration, genres, dress code, sound needs…"
                disabled={!isCustomer}
                className={ui.input}
                style={{ minHeight: 120, resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              <Button
                disabled={!isCustomer || submitting}
                onClick={async () => {
                  try {
                    setError(null);
                    if (!title.trim() || !date) {
                      setError("Title and date are required.");
                      return;
                    }

                    setSubmitting(true);
                    const created = await api.createGig({
                      title: title.trim(),
                      date,
                      time: time || undefined,
                      budget: budget ? Number(budget) : undefined,
                      description: details.trim() || undefined,
                      locationId: locationId || undefined,
                    });
                    setSubmittedId(created.id);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                {submitting ? "Posting..." : "Post gig"}
              </Button>
              <Button
                variant="ghost"
                disabled={submitting}
                onClick={() => {
                  setTitle("");
                  setDate("");
                  setTime("");
                  setBudget("");
                  setDetails("");
                  setError(null);
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function MyGigsPage() {
  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: "http://localhost:4000/api" }),
    [],
  );
  const navigate = useNavigate();

  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .listMyGigs()
      .then((data) => {
        if (cancelled) return;
        setGigs(data);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  return (
    <AppShell
      title="My gigs"
      subtitle="Manage gigs you posted and review applicants."
    >
      {loading ? (
        <p className={ui.help} style={{ fontSize: 14 }}>
          Loading...
        </p>
      ) : error ? (
        <p className={ui.error}>{error}</p>
      ) : gigs.length === 0 ? (
        <p className={ui.help} style={{ fontSize: 14 }}>
          No gigs yet.
        </p>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: spacing.md }}
        >
          {gigs.map((g) => (
            <div
              key={g.id}
              className={[ui.card, ui.cardPad].join(" ")}
              style={{
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: spacing.lg,
                alignItems: "center",
              }}
            >
              <div style={{ minWidth: 240 }}>
                <h3 style={{ fontWeight: 600 }}>{g.title}</h3>
                <p
                  style={{
                    marginTop: spacing.xs,
                    fontSize: 14,
                  }}
                  className={ui.help}
                >
                  {g.date}
                  {g.time ? ` · ${g.time}` : ""} · Status: {g.status}
                </p>
              </div>
              <Button onClick={() => navigate(`/gigs/${g.id}/applicants`)}>
                Review applicants
              </Button>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function GigApplicantsPage() {
  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: "http://localhost:4000/api" }),
    [],
  );
  const { id } = useParams();
  const gigId = id ?? "";
  const navigate = useNavigate();

  const [gig, setGig] = useState<Gig | null>(null);
  const [applications, setApplications] = useState<GigApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!gigId) {
      setError("Missing gig id.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    Promise.all([api.getPublicGig(gigId), api.listGigApplications(gigId)])
      .then(([g, apps]) => {
        if (cancelled) return;
        setGig(g);
        setApplications(apps);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [api, gigId]);

  async function decide(applicationId: string, decision: "accept" | "deny") {
    if (!gigId) return;
    setActionError(null);
    setBusyId(applicationId);
    try {
      const result = await api.decideGigApplication({
        gigId,
        applicationId,
        decision,
      });
      setApplications((prev) =>
        prev.map((a) =>
          a.id === applicationId
            ? {
                ...a,
                status: result.status as GigApplication["status"],
                decidedAt: result.decidedAt,
              }
            : a,
        ),
      );
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell
      title="Applicants"
      subtitle={gig ? gig.title : "Review applications"}
    >
      <Button variant="ghost" onClick={() => navigate("/my-gigs")}>
        Back to my gigs
      </Button>

      {loading ? (
        <p className={ui.help} style={{ fontSize: 14, marginTop: spacing.md }}>
          Loading...
        </p>
      ) : error ? (
        <p className={ui.error} style={{ marginTop: spacing.md }}>
          {error}
        </p>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: spacing.md,
            marginTop: spacing.md,
          }}
        >
          {actionError ? <p className={ui.error}>{actionError}</p> : null}

          {applications.length === 0 ? (
            <p className={ui.help} style={{ fontSize: 14 }}>
              No applications yet.
            </p>
          ) : (
            applications.map((a) => (
              <div
                key={a.id}
                className={[ui.card, ui.cardPad].join(" ")}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: spacing.lg,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "1 1 260px" }}>
                  <h3 style={{ fontWeight: 600 }}>
                    {a.applicant?.name ?? "Applicant"}
                  </h3>
                  <p
                    style={{
                      fontSize: 14,
                      marginTop: spacing.xs,
                    }}
                    className={ui.help}
                  >
                    {a.applicant?.email ?? ""} · Status: {a.status}
                  </p>
                  {a.message ? (
                    <p style={{ marginTop: spacing.sm, fontSize: 14 }}>
                      {a.message}
                    </p>
                  ) : null}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: spacing.sm,
                    alignItems: "center",
                  }}
                >
                  {a.status === "pending" ? (
                    <>
                      <Button
                        disabled={busyId === a.id}
                        onClick={() => decide(a.id, "accept")}
                      >
                        {busyId === a.id ? "Working..." : "Accept"}
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={busyId === a.id}
                        onClick={() => decide(a.id, "deny")}
                      >
                        Deny
                      </Button>
                    </>
                  ) : (
                    <span className={ui.help} style={{ fontSize: 14 }}>
                      Decision: {a.status}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </AppShell>
  );
}

function MessagesPage() {
  return (
    <AppShell
      title="Messages"
      subtitle="Central inbox for conversations with musicians and venues."
    >
      <ChatInbox />
    </AppShell>
  );
}

function RatingsPage() {
  return (
    <AppShell
      title="Ratings & reviews"
      subtitle="History of how your performers and venues have been rated."
    >
      <p className={ui.help} style={{ fontSize: 14 }}>
        This placeholder can evolve into a searchable log of all ratings you’ve
        left and received, plus summaries for repeat collaborators.
      </p>
    </AppShell>
  );
}

type TicketMode = "general_admission" | "assigned_seating";

type TicketSettings = {
  openForTickets: boolean;
  mode: TicketMode;
};

function TicketsPage() {
  const [settings, setSettings] = useState<Record<string, TicketSettings>>(
    () => {
      try {
        const raw = localStorage.getItem("taa.music.ticketSettings");
        if (!raw) return {};
        return JSON.parse(raw) as Record<string, TicketSettings>;
      } catch {
        return {};
      }
    },
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        "taa.music.ticketSettings",
        JSON.stringify(settings),
      );
    } catch {
      // ignore (storage may be unavailable)
    }
  }, [settings]);

  function get(eventId: string): TicketSettings {
    return (
      settings[eventId] ?? {
        openForTickets: false,
        mode: "general_admission",
      }
    );
  }

  function update(eventId: string, next: Partial<TicketSettings>) {
    setSettings((prev) => ({
      ...prev,
      [eventId]: { ...get(eventId), ...next },
    }));
  }

  return (
    <AppShell
      title="Tickets"
      subtitle="Turn ticket sales on per event. Inventory derives from venue seat capacity."
    >
      <div
        className={[ui.stack].join(" ")}
        style={{ "--stack-gap": "14px" } as React.CSSProperties}
      >
        <div className={ui.empty}>
          Seat capacity is set by the venue/location listing. Ticket inventory
          is derived from that capacity (not set by the performer). Assigned
          seating is supported as a higher-complexity mode once layouts exist.
        </div>

        <Section title="Events">
          <div className={[ui.grid, ui.gridCards].join(" ")}>
            {events.map((e) => {
              const s = get(e.id);
              return (
                <div
                  key={e.id}
                  className={[ui.card, ui.cardPad, ui.stack].join(" ")}
                  style={{ "--stack-gap": "12px" } as React.CSSProperties}
                >
                  <div>
                    <p className={ui.cardTitle}>{e.title}</p>
                    <p className={ui.cardText}>
                      {e.date} · {e.time} · {e.venue}
                    </p>
                  </div>

                  <div className={ui.divider} />

                  <div className={ui.rowBetween}>
                    <div
                      className={ui.stack}
                      style={{ "--stack-gap": "4px" } as React.CSSProperties}
                    >
                      <p style={{ fontWeight: 650, fontSize: 13 }}>
                        Open For Tickets
                      </p>
                      <p className={ui.help} style={{ fontSize: 13 }}>
                        Enable attendee ticket sales for this event.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={s.openForTickets}
                      onChange={(ev) =>
                        update(e.id, { openForTickets: ev.target.checked })
                      }
                      aria-label={`Open tickets for ${e.title}`}
                    />
                  </div>

                  <div
                    className={ui.stack}
                    style={{ "--stack-gap": "6px" } as React.CSSProperties}
                  >
                    <label style={{ fontSize: 13, fontWeight: 650 }}>
                      Ticket mode
                    </label>
                    <select
                      className={ui.input}
                      value={s.mode}
                      onChange={(ev) =>
                        update(e.id, { mode: ev.target.value as TicketMode })
                      }
                      disabled={!s.openForTickets}
                    >
                      <option value="general_admission">
                        General admission (at the door)
                      </option>
                      <option value="assigned_seating">
                        Assigned seating (layout required)
                      </option>
                    </select>
                    <p className={ui.help} style={{ fontSize: 13 }}>
                      Capacity: set by venue · Tickets remaining: derived
                    </p>
                  </div>

                  <div className={ui.rowBetween}>
                    <span className={ui.chip}>
                      {s.openForTickets ? "Tickets live" : "Tickets off"}
                    </span>
                    <Button variant="secondary" disabled={!s.openForTickets}>
                      View attendee link
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      </div>
    </AppShell>
  );
}

function NavBar() {
  const { user } = useAuth();
  return (
    <nav className={ui.nav}>
      <NavLink
        to="/"
        className={({ isActive }) =>
          [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
        }
      >
        Concerts
      </NavLink>

      {user?.role.includes("customer") && (
        <>
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            Host
          </NavLink>
          <NavLink
            to="/events"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            Ops
          </NavLink>

          <NavLink
            to="/tickets"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            Ticketing
          </NavLink>
          <NavLink
            to="/ratings"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            Ratings
          </NavLink>

          <NavLink
            to="/my-gigs"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            My events
          </NavLink>

          <NavLink
            to="/post-gig"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            Post event
          </NavLink>
        </>
      )}

      {user && (
        <NavLink
          to="/messages"
          className={({ isActive }) =>
            [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
          }
        >
          Messages
        </NavLink>
      )}

      {user && (
        <NavLink
          to="/my-tickets"
          className={({ isActive }) =>
            [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
          }
        >
          My tickets
        </NavLink>
      )}

      {!user ? (
        <>
          <NavLink
            to="/login"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            Login
          </NavLink>
          <NavLink
            to="/register"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            Register
          </NavLink>
        </>
      ) : (
        <NavLink
          to="/account"
          className={({ isActive }) =>
            [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
          }
        >
          Account
        </NavLink>
      )}
    </nav>
  );
}

function AccountPage() {
  const { user, logout } = useAuth();

  return (
    <AppShell
      title="Customer account"
      subtitle="Your identity for bookings, events, and messaging."
    >
      {user ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: spacing.md,
            maxWidth: 420,
          }}
        >
          <p>
            Signed in as <strong>{user.name}</strong> ({user.email})
          </p>
          <p className={ui.help} style={{ fontSize: 14 }}>
            Roles: {user.role.join(", ")}
          </p>
          <Button
            variant="secondary"
            onClick={logout}
            style={{ alignSelf: "flex-start" }}
          >
            Sign out
          </Button>
        </div>
      ) : (
        <p className={ui.help} style={{ fontSize: 14 }}>
          You are not signed in.
        </p>
      )}
    </AppShell>
  );
}

function App() {
  return (
    <AppFrame app="music">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
          flex: 1,
          minHeight: 0,
        }}
      >
        <div className={ui.chrome}>
          <header className={ui.header}>
            <h1 className={[ui.title, ui.brandTitle].join(" ")}>
              <span className={ui.brandDot} aria-hidden />
              Triple A Music
            </h1>
            <p className={ui.subtitle}>Concerts marketplace</p>
          </header>
          <NavBar />
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/" element={<BrowsePage />} />
            <Route path="/gigs/:id" element={<PublicGigDetailsPage />} />
            <Route path="/browse" element={<BrowsePage />} />
            <Route path="/gigs/:id/tickets" element={<PublicTicketsPage />} />
            <Route path="/my-tickets" element={<MyTicketsPage />} />
            <Route path="/musicians/:id" element={<MusicianDetailsPage />} />
            <Route
              path="/dashboard"
              element={
                <RequireRole role="customer">
                  <CustomerDashboardPage />
                </RequireRole>
              }
            />
            <Route
              path="/events"
              element={
                <RequireRole role="customer">
                  <EventsPage />
                </RequireRole>
              }
            />

            <Route
              path="/tickets"
              element={
                <RequireRole role="customer">
                  <TicketsPage />
                </RequireRole>
              }
            />
            <Route
              path="/messages"
              element={
                <RequireAnyRole
                  roles={["customer", "musician", "rental_provider", "admin"]}
                >
                  <MessagesPage />
                </RequireAnyRole>
              }
            />
            <Route
              path="/ratings"
              element={
                <RequireRole role="customer">
                  <RatingsPage />
                </RequireRole>
              }
            />
            <Route
              path="/post-gig"
              element={
                <RequireRole role="customer">
                  <PostGigPage />
                </RequireRole>
              }
            />
            <Route
              path="/my-gigs"
              element={
                <RequireRole role="customer">
                  <MyGigsPage />
                </RequireRole>
              }
            />
            <Route
              path="/gigs/:id/applicants"
              element={
                <RequireRole role="customer">
                  <GigApplicantsPage />
                </RequireRole>
              }
            />
          </Routes>
        </div>
      </div>
    </AppFrame>
  );
}

export default App;
