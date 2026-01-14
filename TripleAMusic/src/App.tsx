import React, { useEffect, useMemo, useState } from "react";
import type {
  Booking,
  Event,
  Gig,
  GigApplication,
  MusicianProfile,
} from "@shared";
import {
  AppFrame,
  AppShell,
  Button,
  colors,
  spacing,
  TripleAApiClient,
  RequireAnyRole,
  RequireRole,
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

const discoveryResults: DiscoveryResult[] = [
  {
    musician: {
      id: "m1",
      userId: "u1",
      instruments: ["DJ"],
      genres: ["House", "Pop"],
      bio: "High‑energy open‑format DJ for clubs and private events.",
      averageRating: 4.9,
      reviewCount: 212,
    },
    priceEstimate: 780,
    distanceMinutes: 18,
  },
  {
    musician: {
      id: "m2",
      userId: "u2",
      instruments: ["Vocals", "Piano"],
      genres: ["Jazz", "Soul"],
      bio: "Elegant background sets for dinners and hotel lounges.",
      averageRating: 4.7,
      reviewCount: 96,
    },
    priceEstimate: 520,
    distanceMinutes: 11,
  },
];

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
  return (
    <span
      style={{
        padding: `${spacing.xs}px ${spacing.sm}px`,
        borderRadius: 999,
        border: "1px solid #374151",
        fontSize: 12,
      }}
    >
      {label}
    </span>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: spacing.xl }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: spacing.md }}>
        {title}
      </h2>
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

  return (
    <AppShell
      title="Sign in as customer"
      subtitle="Use the same account across Triple A apps."
    >
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
            style={{
              padding: `${spacing.sm}px ${spacing.md}px`,
              borderRadius: 999,
              border: "1px solid #374151",
              backgroundColor: "#020617",
              color: colors.text,
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13 }}>Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: `${spacing.sm}px ${spacing.md}px`,
              borderRadius: 999,
              border: "1px solid #374151",
              backgroundColor: "#020617",
              color: colors.text,
            }}
          />
        </div>
        {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}
        {user && (
          <p style={{ color: "#9ca3af", fontSize: 13 }}>
            You are signed in as {user.email}.
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
          Create a customer account
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
    <AppShell
      title="Create customer account"
      subtitle="Sign up to book musicians and manage events."
    >
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
            style={{
              padding: `${spacing.sm}px ${spacing.md}px`,
              borderRadius: 999,
              border: "1px solid #374151",
              backgroundColor: "#020617",
              color: colors.text,
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13 }}>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: `${spacing.sm}px ${spacing.md}px`,
              borderRadius: 999,
              border: "1px solid #374151",
              backgroundColor: "#020617",
              color: colors.text,
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13 }}>Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: `${spacing.sm}px ${spacing.md}px`,
              borderRadius: 999,
              border: "1px solid #374151",
              backgroundColor: "#020617",
              color: colors.text,
            }}
          />
        </div>
        {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}
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
  return (
    <AppShell
      title="Triple A Music"
      subtitle="Customer app (like Uber Eats): discover musicians/venues and manage every booking."
    >
      <div
        style={{ display: "flex", flexDirection: "column", gap: spacing.xl }}
      >
        <Section title="Event setup">
          <div
            style={{
              padding: spacing.lg,
              borderRadius: 12,
              backgroundColor: "#020617",
              border: "1px solid #1f2937",
              display: "flex",
              flexDirection: "column",
              gap: spacing.md,
            }}
          >
            <div style={{ display: "flex", gap: spacing.md, flexWrap: "wrap" }}>
              <input
                placeholder="Describe your event (e.g. rooftop cocktail, wedding)"
                style={{
                  flex: "1 1 260px",
                  padding: `${spacing.sm}px ${spacing.md}px`,
                  borderRadius: 999,
                  border: "1px solid #374151",
                  backgroundColor: "#020617",
                  color: colors.text,
                }}
              />
              <input
                placeholder="Guests"
                style={{
                  width: 120,
                  padding: `${spacing.sm}px ${spacing.md}px`,
                  borderRadius: 999,
                  border: "1px solid #374151",
                  backgroundColor: "#020617",
                  color: colors.text,
                }}
              />
              <input
                placeholder="Budget"
                style={{
                  width: 140,
                  padding: `${spacing.sm}px ${spacing.md}px`,
                  borderRadius: 999,
                  border: "1px solid #374151",
                  backgroundColor: "#020617",
                  color: colors.text,
                }}
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

        <Section title="Discovery & search">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing.md,
            }}
          >
            {discoveryResults.map((result) => (
              <div
                key={result.musician.id}
                style={{
                  padding: spacing.lg,
                  borderRadius: 12,
                  backgroundColor: "#020617",
                  border: "1px solid #1f2937",
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
                      color: "#9ca3af",
                      fontSize: 14,
                    }}
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
                      color: "#9ca3af",
                    }}
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
                  <Button fullWidth>Request quote</Button>
                  <Button variant="ghost" fullWidth>
                    View profile
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Section>

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
                  style={{
                    padding: spacing.lg,
                    borderRadius: 12,
                    backgroundColor: "#020617",
                    border: "1px solid #1f2937",
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
                        color: "#9ca3af",
                        fontSize: 14,
                      }}
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
          <p style={{ color: "#9ca3af", fontSize: 14 }}>
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
    []
  );

  const [results, setResults] = useState<DiscoveryResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setLoading(true);
    api
      .musicDiscovery({})
      .then((r) => setResults(r))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [api]);

  return (
    <AppShell
      title="Browse musicians"
      subtitle="Explore performers and get an estimate before you book."
    >
      <div
        style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}
      >
        <Section title="Available now">
          {loading ? (
            <p style={{ color: "#9ca3af", fontSize: 14, margin: 0 }}>
              Loading...
            </p>
          ) : error ? (
            <p className={ui.error} style={{ margin: 0 }}>
              {error}
            </p>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: spacing.lg,
            }}
          >
            {(results ?? []).map((r) => {
              const detailsPath = `/musicians/${encodeURIComponent(
                r.musician.id
              )}`;
              return (
                <div
                  key={r.musician.id}
                  style={{
                    padding: spacing.lg,
                    borderRadius: 12,
                    backgroundColor: "#020617",
                    border: "1px solid #1f2937",
                    display: "flex",
                    flexDirection: "column",
                    gap: spacing.sm,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: spacing.sm,
                      flexWrap: "wrap",
                    }}
                  >
                    {r.musician.instruments.map((i) => (
                      <Chip key={i} label={i} />
                    ))}
                    {r.musician.genres.map((g) => (
                      <Chip key={g} label={g} />
                    ))}
                  </div>

                  <p style={{ margin: 0, color: "#e5e7eb", fontWeight: 600 }}>
                    {r.musician.instruments.join(" / ")}
                  </p>
                  <p style={{ margin: 0, color: "#9ca3af", fontSize: 14 }}>
                    {r.musician.bio}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: spacing.md,
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>
                      {r.musician.averageRating.toFixed(1)}★ (
                      {r.musician.reviewCount})
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>
                      ~${r.priceEstimate} · {r.distanceMinutes} min
                    </p>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: spacing.sm,
                      marginTop: spacing.sm,
                    }}
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
          <p style={{ color: "#9ca3af", fontSize: 14, margin: 0 }}>
            Browse performers, view details, then sign in to request and manage
            bookings.
          </p>
        </Section>
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
    []
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
        <p style={{ color: "#9ca3af", fontSize: 14 }}>Loading details...</p>
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
        <p style={{ color: "#9ca3af", fontSize: 14 }}>
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
    events[0]?.id ?? "new"
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
          style={{
            padding: spacing.lg,
            borderRadius: 12,
            backgroundColor: "#020617",
            border: "1px solid #1f2937",
            display: "flex",
            flexDirection: "column",
            gap: spacing.sm,
          }}
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
          <p style={{ margin: 0, color: "#9ca3af", fontSize: 14 }}>
            {musician.bio}
          </p>
          <p style={{ margin: 0, color: "#9ca3af", fontSize: 13 }}>
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
                  musician.id
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
          <div
            style={{
              padding: spacing.lg,
              borderRadius: 12,
              backgroundColor: "#020617",
              border: "1px solid #1f2937",
            }}
          >
            {!user ? (
              <p style={{ margin: 0, color: "#9ca3af", fontSize: 14 }}>
                Sign in to request a booking.
              </p>
            ) : !isCustomer ? (
              <p style={{ margin: 0, color: "#9ca3af", fontSize: 14 }}>
                This action is available in the customer role.
              </p>
            ) : (
              <>
                <p style={{ margin: 0, fontWeight: 600 }}>Request a booking</p>
                <p
                  style={{
                    marginTop: spacing.xs,
                    color: "#9ca3af",
                    fontSize: 14,
                  }}
                >
                  Choose an existing event or create a new one, then submit your
                  request (demo).
                </p>

                {submitError ? (
                  <p className={ui.error} style={{ margin: 0 }}>
                    {submitError}
                  </p>
                ) : null}

                {submitted ? (
                  <div
                    style={{
                      marginTop: spacing.md,
                      padding: spacing.md,
                      borderRadius: 12,
                      border: "1px solid #1f2937",
                      color: "#9ca3af",
                      fontSize: 14,
                    }}
                  >
                    Booking request submitted (demo). Next step is wiring this
                    to the backend.
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
                        style={{
                          padding: `${spacing.sm}px ${spacing.md}px`,
                          borderRadius: 12,
                          border: "1px solid #374151",
                          backgroundColor: "#020617",
                          color: "white",
                        }}
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
                            style={{
                              padding: `${spacing.sm}px ${spacing.md}px`,
                              borderRadius: 12,
                              border: "1px solid #374151",
                              backgroundColor: "#020617",
                              color: "white",
                            }}
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
                            style={{
                              padding: `${spacing.sm}px ${spacing.md}px`,
                              borderRadius: 12,
                              border: "1px solid #374151",
                              backgroundColor: "#020617",
                              color: "white",
                            }}
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
                            style={{
                              padding: `${spacing.sm}px ${spacing.md}px`,
                              borderRadius: 12,
                              border: "1px solid #374151",
                              backgroundColor: "#020617",
                              color: "white",
                            }}
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
                            style={{
                              padding: `${spacing.sm}px ${spacing.md}px`,
                              borderRadius: 12,
                              border: "1px solid #374151",
                              backgroundColor: "#020617",
                              color: "white",
                            }}
                          />
                        </div>
                      </div>
                    ) : selectedEvent ? (
                      <div
                        style={{
                          padding: spacing.md,
                          borderRadius: 12,
                          border: "1px solid #1f2937",
                          color: "#9ca3af",
                          fontSize: 14,
                        }}
                      >
                        Using event:{" "}
                        <strong style={{ color: "#e5e7eb" }}>
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
                          style={{
                            padding: `${spacing.sm}px ${spacing.md}px`,
                            borderRadius: 12,
                            border: "1px solid #374151",
                            backgroundColor: "#020617",
                            color: "white",
                          }}
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
                          style={{
                            padding: `${spacing.sm}px ${spacing.md}px`,
                            borderRadius: 12,
                            border: "1px solid #374151",
                            backgroundColor: "#020617",
                            color: "white",
                          }}
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
                                "Please provide an event name and date."
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
      title="Events"
      subtitle="A dedicated space for the full lifecycle of each event."
    >
      <p style={{ color: "#9ca3af", fontSize: 14 }}>
        Use this route later for per-event timelines, documents, and internal
        notes shared with your team.
      </p>
    </AppShell>
  );
}

function PostGigPage() {
  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: "http://localhost:4000/api" }),
    []
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
        setLocationsError(e instanceof Error ? e.message : String(e))
      )
      .finally(() => setLocationsBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  return (
    <AppShell
      title="Post a gig"
      subtitle="Create a potential gig so musicians can see it (demo)."
    >
      {!isCustomer ? (
        <p style={{ margin: 0, color: "#9ca3af", fontSize: 14 }}>
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
            style={{
              padding: spacing.lg,
              borderRadius: 12,
              backgroundColor: "#020617",
              border: "1px solid #1f2937",
              color: "#9ca3af",
              fontSize: 14,
            }}
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
            style={{
              padding: spacing.lg,
              borderRadius: 12,
              backgroundColor: "#020617",
              border: "1px solid #1f2937",
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
                  style={{
                    padding: `${spacing.sm}px ${spacing.md}px`,
                    borderRadius: 12,
                    border: "1px solid #374151",
                    backgroundColor: "#020617",
                    color: "white",
                  }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 13 }}>Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={!isCustomer}
                  style={{
                    padding: `${spacing.sm}px ${spacing.md}px`,
                    borderRadius: 12,
                    border: "1px solid #374151",
                    backgroundColor: "#020617",
                    color: "white",
                  }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 13 }}>Start time (optional)</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  disabled={!isCustomer}
                  style={{
                    padding: `${spacing.sm}px ${spacing.md}px`,
                    borderRadius: 12,
                    border: "1px solid #374151",
                    backgroundColor: "#020617",
                    color: "white",
                  }}
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
                  style={{
                    padding: `${spacing.sm}px ${spacing.md}px`,
                    borderRadius: 12,
                    border: "1px solid #374151",
                    backgroundColor: "#020617",
                    color: "white",
                  }}
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
                  style={{
                    padding: `${spacing.sm}px ${spacing.md}px`,
                    borderRadius: 12,
                    border: "1px solid #374151",
                    backgroundColor: "#020617",
                    color: "white",
                  }}
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
                style={{
                  minHeight: 120,
                  padding: `${spacing.sm}px ${spacing.md}px`,
                  borderRadius: 12,
                  border: "1px solid #374151",
                  backgroundColor: "#020617",
                  color: "white",
                  resize: "vertical",
                }}
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
    []
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
        <p style={{ color: "#9ca3af", fontSize: 14 }}>Loading...</p>
      ) : error ? (
        <p className={ui.error}>{error}</p>
      ) : gigs.length === 0 ? (
        <p style={{ color: "#9ca3af", fontSize: 14 }}>No gigs yet.</p>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: spacing.md }}
        >
          {gigs.map((g) => (
            <div
              key={g.id}
              style={{
                padding: spacing.lg,
                borderRadius: 12,
                backgroundColor: "#020617",
                border: "1px solid #1f2937",
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
                    color: "#9ca3af",
                    fontSize: 14,
                  }}
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
    []
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
            : a
        )
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
        <p style={{ color: "#9ca3af", fontSize: 14, marginTop: spacing.md }}>
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
            <p style={{ color: "#9ca3af", fontSize: 14 }}>
              No applications yet.
            </p>
          ) : (
            applications.map((a) => (
              <div
                key={a.id}
                style={{
                  padding: spacing.lg,
                  borderRadius: 12,
                  backgroundColor: "#020617",
                  border: "1px solid #1f2937",
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
                      color: "#9ca3af",
                      fontSize: 14,
                      marginTop: spacing.xs,
                    }}
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
                    <span style={{ color: "#9ca3af", fontSize: 14 }}>
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
      <p style={{ color: "#9ca3af", fontSize: 14 }}>
        This placeholder can evolve into a searchable log of all ratings you’ve
        left and received, plus summaries for repeat collaborators.
      </p>
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
        Browse
      </NavLink>

      {user?.role.includes("customer") && (
        <>
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/events"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            Events
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
            My gigs
          </NavLink>

          <NavLink
            to="/post-gig"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            Post gig
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
          <p style={{ color: "#9ca3af", fontSize: 14 }}>
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
        <p style={{ color: "#9ca3af", fontSize: 14 }}>You are not signed in.</p>
      )}
    </AppShell>
  );
}

function App() {
  return (
    <AppFrame>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
          flex: 1,
          minHeight: 0,
        }}
      >
        <NavBar />
        <div style={{ flex: 1, minHeight: 0 }}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/" element={<BrowsePage />} />
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
