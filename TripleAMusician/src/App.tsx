import React from "react";
import type { Booking, MusicianProfile, Perk } from "@shared";
import {
  AppShell,
  Button,
  colors,
  spacing,
  useAuth,
  RequireRole,
} from "@shared";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import "./App.css";

const mockProfile: MusicianProfile = {
  id: "m1",
  userId: "u1",
  instruments: ["Guitar", "Vocals"],
  genres: ["Pop", "Funk", "Jazz"],
  bio: "Reliable, high‑energy performer for weddings, corporate events, and clubs.",
  averageRating: 4.8,
  reviewCount: 124,
};

const upcomingBookings: Booking[] = [
  {
    id: "b1",
    eventId: "e1",
    musicianId: "m1",
    payout: 450,
    status: "confirmed",
  },
  {
    id: "b2",
    eventId: "e2",
    musicianId: "m1",
    payout: 320,
    status: "requested",
  },
];

const perks: Perk[] = [
  {
    id: "p1",
    name: "Custom embroidery pack",
    description: "Branded jacket and gig bag after 20 completed 5★ gigs.",
    minRating: 4.7,
    minCompletedBookings: 20,
  },
  {
    id: "p2",
    name: "Rehearsal room credits",
    description: "Monthly rehearsal credit when your rating stays above 4.5.",
    minRating: 4.5,
  },
];

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: `${spacing.sm}px ${spacing.md}px`,
        borderRadius: 999,
        backgroundColor: "#020617",
        border: `1px solid ${colors.surfaceAlt ?? "#1f2937"}`,
        display: "inline-flex",
        flexDirection: "column",
        gap: 2,
        minWidth: 120,
      }}
    >
      <span style={{ fontSize: 12, color: "#9ca3af" }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 600 }}>{value}</span>
    </div>
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
      title="Sign in as musician"
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
          Create a musician account
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
      await register({ name, email, password, roles: ["musician"] });
      navigate("/");
    } catch (err) {
      setError("Registration failed. Please try a different email.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      title="Create musician account"
      subtitle="Sign up to manage gigs, ratings, and perks."
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
function MusicianDashboardPage() {
  return (
    <AppShell
      title="Triple A Musician"
      subtitle="Your control center for gigs, ratings, and musician perks."
    >
      <div
        style={{ display: "flex", flexDirection: "column", gap: spacing.xl }}
      >
        <Section title="Profile & rating">
          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.lg }}>
            <div style={{ flex: "1 1 220px" }}>
              <h3 style={{ fontSize: 20, fontWeight: 600 }}>Alex Rivers</h3>
              <p style={{ marginTop: spacing.sm, color: "#9ca3af" }}>
                {mockProfile.bio}
              </p>
              <p style={{ marginTop: spacing.sm, fontSize: 14 }}>
                Instruments: {mockProfile.instruments.join(", ")}
                <br />
                Genres: {mockProfile.genres.join(", ")}
              </p>
              <Button style={{ marginTop: spacing.md }}>Edit profile</Button>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: spacing.sm,
                justifyContent: "center",
              }}
            >
              <StatPill
                label="Average rating"
                value={`${mockProfile.averageRating.toFixed(1)} ★`}
              />
              <StatPill
                label="Reviews"
                value={`${mockProfile.reviewCount.toString()} total`}
              />
            </div>
          </div>
        </Section>

        <Section title="Bookings & obligations">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing.md,
            }}
          >
            {upcomingBookings.map((b) => (
              <div
                key={b.id}
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
                <div>
                  <h3 style={{ fontWeight: 600 }}>
                    Wedding reception · Downtown Loft
                  </h3>
                  <p
                    style={{
                      marginTop: spacing.xs,
                      color: "#9ca3af",
                      fontSize: 14,
                    }}
                  >
                    Sat · 19:00–23:00 · Smart casual · 2x 60min sets
                  </p>
                  <p style={{ marginTop: spacing.xs, fontSize: 14 }}>
                    Payout: ${b.payout.toFixed(0)}
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
                  <Button variant="secondary">View details</Button>
                  {b.status === "requested" ? (
                    <div style={{ display: "flex", gap: spacing.sm }}>
                      <Button fullWidth>Accept</Button>
                      <Button variant="ghost" fullWidth>
                        Decline
                      </Button>
                    </div>
                  ) : (
                    <Button fullWidth>Confirm arrival</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Perks & rewards">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing.md,
            }}
          >
            {perks.map((perk) => (
              <div
                key={perk.id}
                style={{
                  padding: spacing.lg,
                  borderRadius: 12,
                  backgroundColor: "#020617",
                  border: "1px dashed #374151",
                }}
              >
                <h3 style={{ fontWeight: 600 }}>{perk.name}</h3>
                <p
                  style={{
                    marginTop: spacing.xs,
                    color: "#9ca3af",
                    fontSize: 14,
                  }}
                >
                  {perk.description}
                </p>
                <p
                  style={{
                    marginTop: spacing.sm,
                    fontSize: 13,
                    color: "#9ca3af",
                  }}
                >
                  Unlock rules:{" "}
                  {perk.minRating ? `Rating ≥ ${perk.minRating}` : null}
                  {perk.minRating && perk.minCompletedBookings ? " · " : null}
                  {perk.minCompletedBookings
                    ? `${perk.minCompletedBookings}+ completed bookings`
                    : null}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Notifications (coming soon)">
          <p style={{ color: "#9ca3af", fontSize: 14 }}>
            This home screen will also surface booking changes, new requests,
            and perk unlocks so you always know what needs attention.
          </p>
        </Section>
      </div>
    </AppShell>
  );
}

function BookingsPage() {
  return (
    <AppShell
      title="Bookings overview"
      subtitle="Upcoming and past gigs, with quick access to details."
    >
      <p style={{ color: "#9ca3af", fontSize: 14 }}>
        This is a placeholder route. You can expand it with filters (by date,
        venue, status) and a timeline-style history.
      </p>
    </AppShell>
  );
}

function PerksPage() {
  return (
    <AppShell
      title="Perks center"
      subtitle="Track what you’ve unlocked and what’s coming next."
    >
      <p style={{ color: "#9ca3af", fontSize: 14 }}>
        This route is a good home for detailed perk tiers, progress bars, and
        redemption history.
      </p>
    </AppShell>
  );
}

function ProfilePage() {
  const { user, logout } = useAuth();

  return (
    <AppShell
      title="Musician account"
      subtitle="Basic auth demo wired through the shared AuthProvider."
    >
      <div
        style={{ display: "flex", flexDirection: "column", gap: spacing.md }}
      >
        {user ? (
          <>
            <p>
              Signed in as <strong>{user.name}</strong> ({user.email})
            </p>
            <p style={{ fontSize: 14, color: "#9ca3af" }}>
              Roles: {user.role.join(", ")}
            </p>
            <Button
              variant="secondary"
              onClick={logout}
              style={{ alignSelf: "flex-start" }}
            >
              Sign out
            </Button>
          </>
        ) : (
          <>
            <p style={{ color: "#9ca3af", fontSize: 14 }}>
              You are not signed in. Use the Login link in the navigation to
              access your musician dashboard.
            </p>
          </>
        )}
      </div>
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
        to="/bookings"
        style={({ isActive }) => ({
          ...linkStyle,
          ...(isActive ? activeStyle : {}),
        })}
      >
        Bookings
      </NavLink>
      <NavLink
        to="/perks"
        style={({ isActive }) => ({
          ...linkStyle,
          ...(isActive ? activeStyle : {}),
        })}
      >
        Perks
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
      <NavLink
        to="/profile"
        style={({ isActive }) => ({
          ...linkStyle,
          ...(isActive ? activeStyle : {}),
        })}
      >
        Account
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
            <RequireRole role="musician">
              <MusicianDashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="/bookings"
          element={
            <RequireRole role="musician">
              <BookingsPage />
            </RequireRole>
          }
        />
        <Route
          path="/perks"
          element={
            <RequireRole role="musician">
              <PerksPage />
            </RequireRole>
          }
        />
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
    </div>
  );
}

export default App;
