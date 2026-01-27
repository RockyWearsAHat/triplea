import React from "react";
import type { Gig } from "@shared";
import {
  AppFrame,
  AppShell,
  Button,
  spacing,
  useScrollReveal,
  useAuth,
  RequireAnyRole,
  RequireRole,
  ChatInbox,
} from "@shared";
import { Route, Routes, useNavigate, useParams } from "react-router-dom";
import "./App.css";
import ui from "@shared/styles/primitives.module.scss";
import { NavBar } from "./components/NavBar";
import { DashboardPage } from "./pages/DashboardPage";
import { ProfilePage } from "./pages/ProfilePage";
import { createApiClient, getAssetUrl, getMusicOrigin } from "./lib/urls";

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

const MUSIC_ORIGIN = getMusicOrigin();

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
      navigate("/dashboard");
    } catch (err) {
      setError("Login failed. Please check your details and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="Sign in to Triple A Musician" centered>
      <form
        onSubmit={handleSubmit}
        style={{
          maxWidth: 360,
          width: "100%",
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
          <button
            type="button"
            onClick={() => navigate("/forgot-password")}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontSize: 13,
              color: "var(--gold)",
              cursor: "pointer",
              alignSelf: "flex-end",
              marginTop: 4,
            }}
          >
            Forgot password?
          </button>
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

        <div
          style={{
            marginTop: spacing.xl,
            paddingTop: spacing.md,
            borderTop: "1px solid var(--border)",
            textAlign: "center",
          }}
        >
          <p className={ui.help} style={{ marginBottom: spacing.sm }}>
            Not a musician?{" "}
            <a
              href={MUSIC_ORIGIN}
              style={{ color: "var(--gold)", textDecoration: "underline" }}
            >
              Browse and host concerts here
            </a>
          </p>
        </div>
      </form>
    </AppShell>
  );
}

function MusicianLandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div>
      {/* Hero - Full viewport, one bold message */}
      <section className={ui.heroFull}>
        <p className={ui.heroKicker}>Triple A Musician</p>
        <h1 className={ui.heroMassive}>You're in the family.</h1>
        <p className={ui.heroSubtitleLarge}>
          One clean dashboard for your requests, bookings, and perks — with a
          real team behind it.
        </p>
        <div className={ui.heroActionsLarge}>
          {user?.role.includes("musician") ? (
            <Button size="lg" onClick={() => navigate("/dashboard")}>
              Open my dashboard
            </Button>
          ) : (
            <>
              <Button size="lg" onClick={() => navigate("/register")}>
                Join as a musician
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => navigate("/login")}
              >
                Sign in
              </Button>
            </>
          )}
        </div>
      </section>

      {/* Feature highlights - clean section */}
      <section className={ui.sectionFullCenter}>
        <h2 className={ui.sectionTitleLarge}>Everything you need</h2>
        <p className={ui.sectionLead}>
          Focus on performing. We handle the rest.
        </p>

        <div className={ui.pathGrid} style={{ marginTop: 40 }}>
          <div className={ui.pathCard}>
            <p className={ui.pathCardTitle}>Requests</p>
            <p className={ui.pathCardDesc}>
              Clear offers, quick decisions, no chaos. Accept or decline with
              one tap.
            </p>
          </div>
          <div className={ui.pathCard}>
            <p className={ui.pathCardTitle}>Schedule</p>
            <p className={ui.pathCardDesc}>
              Today, this week, and what's next — all in one place.
            </p>
          </div>
          <div className={ui.pathCard}>
            <p className={ui.pathCardTitle}>Perks</p>
            <p className={ui.pathCardDesc}>
              Build reputation and unlock real rewards as you grow.
            </p>
          </div>
        </div>
      </section>

      {/* Cross-app link */}
      <section className={ui.sectionFull} style={{ textAlign: "center" }}>
        <p className={ui.help} style={{ marginBottom: 8 }}>
          Looking for events to attend instead?
        </p>
        <a
          href={MUSIC_ORIGIN}
          style={{
            color: "var(--primary)",
            fontWeight: 500,
            textDecoration: "underline",
          }}
        >
          Browse concerts on Triple A Music →
        </a>
      </section>

      {/* Mission footer */}
      <section className={ui.missionSection}>
        <p className={ui.missionText}>
          Triple A Musician is your professional home base — built for
          performers who want clarity, not chaos.
        </p>
      </section>
    </div>
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
    <AppShell title="Create musician account" centered>
      <form
        onSubmit={handleSubmit}
        style={{
          maxWidth: 360,
          width: "100%",
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

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const api = React.useMemo(() => createApiClient(), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await api.requestPasswordReset(email);
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <AppShell title="Check your email" centered>
        <div
          style={{
            maxWidth: 400,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: spacing.md,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: spacing.sm }}>📧</div>
          <p style={{ color: "var(--text-primary)", lineHeight: 1.5 }}>
            If an account exists for <strong>{email}</strong>, you'll receive an
            email with instructions to reset your password.
          </p>
          <p className={ui.help}>
            Didn't receive the email? Check your spam folder or try again.
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing.sm,
              marginTop: spacing.md,
            }}
          >
            <Button onClick={() => setSuccess(false)} variant="ghost">
              Try a different email
            </Button>
            <Button onClick={() => navigate("/login")}>Back to sign in</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Reset your password" centered>
      <form
        onSubmit={handleSubmit}
        style={{
          maxWidth: 360,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
        }}
      >
        <p className={ui.help}>
          Enter your email address and we'll send you a link to reset your
          password.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13 }}>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={ui.input}
            autoFocus
          />
        </div>

        {error && <p className={ui.error}>{error}</p>}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Sending..." : "Send reset link"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate("/login")}
        >
          Back to sign in
        </Button>
      </form>
    </AppShell>
  );
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = React.useMemo(
    () => [new URLSearchParams(window.location.search)],
    [],
  );
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const api = React.useMemo(() => createApiClient(), []);

  if (!token) {
    return (
      <AppShell title="Invalid link" centered>
        <div
          style={{
            maxWidth: 400,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: spacing.md,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: spacing.sm }}>⚠️</div>
          <p style={{ color: "var(--text-primary)", lineHeight: 1.5 }}>
            This password reset link is invalid or has expired.
          </p>
          <p className={ui.help}>Please request a new password reset link.</p>
          <Button onClick={() => navigate("/forgot-password")}>
            Request new link
          </Button>
        </div>
      </AppShell>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);

    try {
      await api.resetPassword(token!, newPassword);
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <AppShell title="Password reset" centered>
        <div
          style={{
            maxWidth: 400,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: spacing.md,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: spacing.sm }}>✅</div>
          <p style={{ color: "var(--text-primary)", lineHeight: 1.5 }}>
            Your password has been reset successfully.
          </p>
          <p className={ui.help}>You can now sign in with your new password.</p>
          <Button onClick={() => navigate("/login")}>Sign in</Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Create new password" centered>
      <form
        onSubmit={handleSubmit}
        style={{
          maxWidth: 360,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
        }}
      >
        <p className={ui.help}>Enter your new password below.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13 }}>New password</label>
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={ui.input}
            autoFocus
          />
          <p className={ui.help}>Minimum 8 characters</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13 }}>Confirm password</label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={ui.input}
          />
        </div>

        {error && <p className={ui.error}>{error}</p>}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Resetting..." : "Reset password"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate("/login")}
        >
          Back to sign in
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
function RentalsPage() {
  const api = React.useMemo(() => createApiClient(), []);
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  const [instruments, setInstruments] = React.useState<
    Array<{
      id: string;
      name: string;
      category: string;
      dailyRate: number;
      available: boolean;
      imageUrl?: string;
    }>
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState("All");

  useScrollReveal(contentRef, [instruments.length, loading, category]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getMarketplaceCatalog()
      .then((c) => {
        if (cancelled) return;
        setInstruments(c.instruments);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Failed to load instruments.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const categories = React.useMemo(() => {
    const cats = Array.from(new Set(instruments.map((i) => i.category))).sort();
    return ["All", ...cats];
  }, [instruments]);

  const filtered = React.useMemo(() => {
    if (category === "All") return instruments;
    return instruments.filter((i) => i.category === category);
  }, [instruments, category]);

  function apiImageUrl(pathname?: string): string | undefined {
    if (!pathname) return undefined;
    if (/^https?:\/\//i.test(pathname)) return pathname;
    return getAssetUrl(pathname);
  }

  return (
    <AppShell
      title="Instrument rentals"
      subtitle="Rent quality gear for your next gig."
    >
      <div
        ref={contentRef}
        style={{ display: "flex", flexDirection: "column", gap: spacing.md }}
      >
        <div
          className={ui.scroller}
          style={{ "--scroller-gap": "8px" } as React.CSSProperties}
        >
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={category === cat ? "secondary" : "ghost"}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>

        {loading ? (
          <p className={ui.help}>Loading instruments...</p>
        ) : error ? (
          <p className={ui.error}>{error}</p>
        ) : filtered.length === 0 ? (
          <p className={ui.help}>No instruments available in this category.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: spacing.md,
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            }}
          >
            {filtered.map((inst) => (
              <div
                key={inst.id}
                data-reveal
                className={[ui.card, ui.cardPad, ui.stack].join(" ")}
                style={{ "--stack-gap": "10px" } as React.CSSProperties}
              >
                <div className={[ui.media, ui.mediaSquare].join(" ")}>
                  {inst.imageUrl ? (
                    <img
                      src={apiImageUrl(inst.imageUrl)}
                      alt={inst.name}
                      loading="lazy"
                    />
                  ) : (
                    <div className={ui.mediaPlaceholder}>{inst.category}</div>
                  )}
                </div>
                <div>
                  <p className={ui.cardTitle}>{inst.name}</p>
                  <p className={ui.cardText}>{inst.category}</p>
                </div>
                <div className={ui.rowBetween}>
                  <span className={ui.chip}>
                    {inst.available ? "Available" : "Unavailable"}
                  </span>
                  <p className={ui.help} style={{ margin: 0, fontWeight: 600 }}>
                    ${inst.dailyRate}/day
                  </p>
                </div>
                <Button
                  variant="secondary"
                  disabled={!inst.available}
                  fullWidth
                >
                  {inst.available ? "Request rental" : "Not available"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
function BrowseGigsPage() {
  const api = React.useMemo(() => createApiClient(), []);
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
  const api = React.useMemo(() => createApiClient(), []);
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
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
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
              path="/rentals"
              element={
                <RequireRole role="musician">
                  <RentalsPage />
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
