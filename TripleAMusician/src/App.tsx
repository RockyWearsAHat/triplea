import React from "react";
import type { Gig } from "@shared";
import {
  AppFrame,
  AppShell,
  Button,
  spacing,
  TripleAApiClient,
  useScrollReveal,
  useAuth,
  RequireAnyRole,
  RequireRole,
  ChatInbox,
} from "@shared";
import {
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import "./App.css";
import ui from "@shared/styles/primitives.module.scss";
import { DashboardPage } from "./pages/DashboardPage";

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
        {user && <p className={ui.help}>You are signed in as {user.email}.</p>}
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

function MusicianLandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <AppShell
      title="Welcome"
      subtitle="Your performer home base: requests, schedule, and support."
    >
      <section className={ui.hero}>
        <div>
          <p className={ui.heroKicker}>Triple A Musician</p>
          <h2 className={ui.heroTitle}>You’re in the family.</h2>
          <p className={ui.heroLead}>
            One clean dashboard for your requests, bookings, and perks — with a
            real team behind it.
          </p>

          <div className={ui.heroActions}>
            {user?.role.includes("musician") ? (
              <Button onClick={() => navigate("/dashboard")}>
                Open my dashboard
              </Button>
            ) : (
              <>
                <Button onClick={() => navigate("/register")}>
                  Join as a musician
                </Button>
                <Button variant="secondary" onClick={() => navigate("/login")}>
                  Sign in
                </Button>
              </>
            )}
          </div>
        </div>

        <div className={ui.featureGrid}>
          <div className={ui.featureCard}>
            <p className={ui.featureTitle}>Requests</p>
            <p className={ui.featureBody}>
              Clear offers, quick decisions, no chaos.
            </p>
          </div>
          <div className={ui.featureCard}>
            <p className={ui.featureTitle}>Schedule</p>
            <p className={ui.featureBody}>Today, this week, and what’s next.</p>
          </div>
          <div className={ui.featureCard}>
            <p className={ui.featureTitle}>Perks</p>
            <p className={ui.featureBody}>
              Build reputation and unlock real rewards.
            </p>
          </div>
        </div>
      </section>
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
    <AppShell title="Create musician account">
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

function BookingsPage() {
  return (
    <AppShell
      title="Bookings overview"
      subtitle="Upcoming and past gigs, with quick access to details."
    >
      <p className={ui.help} style={{ fontSize: 14 }}>
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
      <p className={ui.help} style={{ fontSize: 14 }}>
        This route is a good home for detailed perk tiers, progress bars, and
        redemption history.
      </p>
    </AppShell>
  );
}

function BrowseGigsPage() {
  const api = React.useMemo(
    () => new TripleAApiClient({ baseUrl: "http://localhost:4000/api" }),
    [],
  );
  const navigate = useNavigate();
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const [gigs, setGigs] = React.useState<Gig[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  useScrollReveal(contentRef, [gigs.length, loading]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .listPublicGigs()
      .then((data) => {
        if (cancelled) return;
        setGigs(data);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Failed to load gigs.");
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
      title="Browse gigs"
      subtitle="Find open gigs posted by customers and apply."
    >
      <div
        ref={contentRef}
        style={{ display: "flex", flexDirection: "column", gap: spacing.md }}
      >
        {loading ? (
          <p className={ui.help}>Loading...</p>
        ) : error ? (
          <p className={ui.error}>{error}</p>
        ) : gigs.length === 0 ? (
          <p className={ui.help}>No gigs available yet.</p>
        ) : (
          gigs.map((gig) => (
            <div
              key={gig.id}
              data-reveal
              className={[ui.card, ui.cardPad].join(" ")}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: spacing.lg,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div style={{ minWidth: 220 }}>
                <h3 style={{ fontWeight: 600 }}>{gig.title}</h3>
                <p
                  style={{
                    marginTop: spacing.xs,
                    fontSize: 14,
                  }}
                  className={ui.help}
                >
                  Budget:{" "}
                  {typeof gig.budget === "number"
                    ? `$${gig.budget.toFixed(0)}`
                    : "—"}{" "}
                  · Status: {gig.status}
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => navigate(`/gigs/${gig.id}`)}
              >
                View gig
              </Button>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}

function GigDetailPage() {
  const api = React.useMemo(
    () => new TripleAApiClient({ baseUrl: "http://localhost:4000/api" }),
    [],
  );
  const params = useParams();
  const gigId = params.id ?? "";
  const navigate = useNavigate();

  const [gig, setGig] = React.useState<Gig | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [message, setMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    if (!gigId) {
      setError("Missing gig id.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    api
      .getPublicGig(gigId)
      .then((data) => {
        if (cancelled) return;
        setGig(data);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Failed to load gig.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [api, gigId]);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!gigId) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.applyToGig(gigId, { message: message.trim() || undefined });
      setSubmitted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.toLowerCase().includes("already")) {
        setSubmitted(true);
      } else {
        setSubmitError(msg || "Failed to submit application.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="Gig details" subtitle="Review the gig and apply.">
      <Button variant="ghost" onClick={() => navigate("/gigs")}>
        Back to gigs
      </Button>

      {loading ? (
        <p className={ui.help} style={{ marginTop: spacing.md }}>
          Loading...
        </p>
      ) : error ? (
        <p className={ui.error} style={{ marginTop: spacing.md }}>
          {error}
        </p>
      ) : !gig ? (
        <p className={ui.help} style={{ marginTop: spacing.md }}>
          Gig not found.
        </p>
      ) : (
        <div style={{ marginTop: spacing.md }}>
          <Section title={gig.title}>
            <p className={ui.help}>
              Budget:{" "}
              {typeof gig.budget === "number"
                ? `$${gig.budget.toFixed(0)}`
                : "—"}{" "}
              · Status: {gig.status}
            </p>
            {gig.description ? (
              <p style={{ marginTop: spacing.sm, fontSize: 14 }}>
                {gig.description}
              </p>
            ) : null}
          </Section>

          <Section title="Apply">
            {submitted ? (
              <p className={ui.help}>Application submitted.</p>
            ) : (
              <form
                onSubmit={handleApply}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: spacing.md,
                  maxWidth: 560,
                }}
              >
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <label style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    Message to customer (optional)
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    className={ui.input}
                    style={{ resize: "vertical" }}
                  />
                </div>

                {submitError && <p className={ui.error}>{submitError}</p>}

                <Button type="submit" disabled={submitting}>
                  {submitting ? "Submitting..." : "Apply"}
                </Button>
              </form>
            )}
          </Section>
        </div>
      )}
    </AppShell>
  );
}

function ProfilePage() {
  const { user, logout } = useAuth();

  return (
    <AppShell
      title="Musician account"
      subtitle="Manage your account and security settings."
    >
      <div
        style={{ display: "flex", flexDirection: "column", gap: spacing.md }}
      >
        {user ? (
          <>
            <p>
              Signed in as <strong>{user.name}</strong> ({user.email})
            </p>
            <p className={ui.help}>Roles: {user.role.join(", ")}</p>
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
            <p className={ui.help}>
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
  const { user } = useAuth();
  return (
    <nav className={ui.nav}>
      <NavLink
        to="/"
        className={({ isActive }) =>
          [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
        }
      >
        Overview
      </NavLink>

      {user?.role.includes("musician") && (
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
            to="/bookings"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            Bookings
          </NavLink>
          <NavLink
            to="/perks"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            Perks
          </NavLink>
          <NavLink
            to="/gigs"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            Gigs
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
          to="/profile"
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

function MessagesPage() {
  return (
    <AppShell
      title="Messages"
      subtitle="Central inbox for conversations with customers, venues, and internal support."
    >
      <ChatInbox />
    </AppShell>
  );
}

function App() {
  return (
    <AppFrame app="musician">
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
              Triple A Musician
            </h1>
            <p className={ui.subtitle}>Performer console</p>
          </header>
          <NavBar />
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={<MusicianLandingPage />} />
            <Route
              path="/dashboard"
              element={
                <RequireRole role="musician">
                  <DashboardPage />
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
            <Route
              path="/gigs"
              element={
                <RequireRole role="musician">
                  <BrowseGigsPage />
                </RequireRole>
              }
            />
            <Route
              path="/gigs/:id"
              element={
                <RequireRole role="musician">
                  <GigDetailPage />
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
              path="/profile"
              element={
                <RequireRole role="musician">
                  <ProfilePage />
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
