import React from "react";
import type { Booking, Event, MusicianProfile } from "@shared";
import {
  AppShell,
  Button,
  colors,
  spacing,
  RequireRole,
  useAuth,
} from "@shared";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import "./App.css";

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
      subtitle="Plan events, discover performers and venues, and manage every booking in one place."
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

function MessagesPage() {
  return (
    <AppShell
      title="Messages"
      subtitle="Central inbox for conversations with musicians and venues."
    >
      <p style={{ color: "#9ca3af", fontSize: 14 }}>
        Eventually this can show threads grouped by event, with quick actions to
        confirm details or send last‑minute updates.
      </p>
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
  const linkStyle: React.CSSProperties = {
    fontSize: 13,
    padding: `${spacing.xs}px ${spacing.sm}px`,
  };

  const activeStyle: React.CSSProperties = {
    textDecoration: "underline",
  };

  return (
    <nav style={{ marginBottom: spacing.md, display: "flex", gap: spacing.sm }}>
      <NavLink
        to="/"
        style={({ isActive }) => ({
          ...linkStyle,
          ...(isActive ? activeStyle : {}),
        })}
      >
        Dashboard
      </NavLink>
      <NavLink
        to="/events"
        style={({ isActive }) => ({
          ...linkStyle,
          ...(isActive ? activeStyle : {}),
        })}
      >
        Events
      </NavLink>
      <NavLink
        to="/messages"
        style={({ isActive }) => ({
          ...linkStyle,
          ...(isActive ? activeStyle : {}),
        })}
      >
        Messages
      </NavLink>
      <NavLink
        to="/ratings"
        style={({ isActive }) => ({
          ...linkStyle,
          ...(isActive ? activeStyle : {}),
        })}
      >
        Ratings
      </NavLink>
      <NavLink
        to="/login"
        style={({ isActive }) => ({
          ...linkStyle,
          ...(isActive ? activeStyle : {}),
        })}
      >
        Login
      </NavLink>
    </nav>
  );
}

function App() {
  return (
    <div style={{ paddingTop: spacing.sm }}>
      <NavBar />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
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
            <RequireRole role="customer">
              <MessagesPage />
            </RequireRole>
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
      </Routes>
    </div>
  );
}

export default App;
