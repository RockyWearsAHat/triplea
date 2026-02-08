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
import { MusicianOnboardingPage } from "./pages/MusicianOnboardingPage";
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

function MusicianAccessGate() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const api = React.useMemo(() => createApiClient(), []);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleEnableAccess() {
    setError(null);
    setSubmitting(true);
    try {
      await api.enableMusicianAccess();
      await refreshUser();
      navigate("/onboarding");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to enable musician access. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) {
    return (
      <div
        className={ui.section}
        style={{ display: "flex", justifyContent: "center" }}
      >
        <div
          className={[ui.card, ui.cardPad].join(" ")}
          style={{ maxWidth: 560, width: "100%" }}
        >
          <h2 className={ui.sectionTitle}>Sign in to access Musician</h2>
          <p className={ui.help}>
            Use your existing account or create a new musician profile.
          </p>
          <div
            style={{
              display: "flex",
              gap: spacing.sm,
              flexWrap: "wrap",
              marginTop: spacing.md,
            }}
          >
            <Button onClick={() => navigate("/login")}>Sign in</Button>
            <Button variant="secondary" onClick={() => navigate("/register")}>
              Create musician account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={ui.section}
      style={{ display: "flex", justifyContent: "center" }}
    >
      <div
        className={[ui.card, ui.cardPad].join(" ")}
        style={{ maxWidth: 620, width: "100%" }}
      >
        <h2 className={ui.sectionTitle}>Musician access required</h2>
        <p className={ui.help}>
          {user.email} doesn&apos;t have performer access yet. Enable musician
          access to continue.
        </p>
        {error && <p className={ui.error}>{error}</p>}
        <div
          style={{
            display: "flex",
            gap: spacing.sm,
            flexWrap: "wrap",
            marginTop: spacing.md,
          }}
        >
          <Button onClick={handleEnableAccess} disabled={submitting}>
            {submitting ? "Enabling..." : "Enable musician access"}
          </Button>
          <Button variant="secondary" onClick={() => navigate("/")}>
            Back to home
          </Button>
        </div>
      </div>
    </div>
  );
}

function MusicianSetupGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const api = React.useMemo(() => createApiClient(), []);
  const [loading, setLoading] = React.useState(true);
  const [stripeReady, setStripeReady] = React.useState(false);
  const [profileReady, setProfileReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [stripe, profile] = await Promise.all([
          api.getMusicianStripeStatus(),
          api.getMyMusicianProfile(),
        ]);
        if (cancelled) return;
        setStripeReady(!!stripe.chargesEnabled && !!stripe.payoutsEnabled);
        setProfileReady(
          (profile.instruments?.length ?? 0) > 0 &&
            (profile.genres?.length ?? 0) > 0 &&
            !!profile.bio?.trim(),
        );
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Unable to check onboarding status.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [api, user]);

  if (loading) {
    return (
      <div
        className={ui.section}
        style={{ display: "flex", justifyContent: "center" }}
      >
        <div className={[ui.card, ui.cardPad].join(" ")}>
          <p className={ui.help}>Checking musician setup…</p>
        </div>
      </div>
    );
  }

  if (stripeReady && profileReady) {
    return <>{children}</>;
  }

  return (
    <div
      className={ui.section}
      style={{ display: "flex", justifyContent: "center" }}
    >
      <div
        className={[ui.card, ui.cardPad].join(" ")}
        style={{ maxWidth: 640, width: "100%" }}
      >
        <h2 className={ui.sectionTitle}>Finish musician onboarding</h2>
        <p className={ui.help}>
          Complete payouts and your performer profile to access the dashboard.
        </p>
        {error && <p className={ui.error}>{error}</p>}
        <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
          <Button onClick={() => navigate("/onboarding")}>
            Go to onboarding
          </Button>
          <Button variant="secondary" onClick={() => navigate("/")}>
            Back to home
          </Button>
        </div>
      </div>
    </div>
  );
}

function RequireMusician({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole role="musician" fallback={<MusicianAccessGate />}>
      <MusicianSetupGate>{children}</MusicianSetupGate>
    </RequireRole>
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
              style={{ color: "var(--primary)", textDecoration: "underline" }}
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
        <h1 className={ui.heroMassive}>Your performer console.</h1>
        <p className={ui.heroSubtitleLarge}>
          Keep requests, bookings, and perks in one place — built for fast
          decisions and a clean weekly rhythm.
        </p>
        <div className={ui.heroActionsLarge}>
          {user ? (
            <Button size="lg" onClick={() => navigate("/dashboard")}>
              {user.role.includes("musician")
                ? "Open my dashboard"
                : "Get started"}
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
          Focus on performing. Stay organized, stay ready.
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
    <AppShell title="Join as a musician" centered>
      <div className={ui.formSection} style={{ maxWidth: 400, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <h2 className={ui.formSectionTitle} style={{ fontSize: 20 }}>
            Create your account
          </h2>
          <p className={ui.formSectionDesc} style={{ margin: "4px auto 0" }}>
            Start performing with Triple A
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div className={ui.field}>
            <label className={ui.label}>Full name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={ui.input}
              placeholder="John Smith"
            />
          </div>
          <div className={ui.field}>
            <label className={ui.label}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={ui.input}
              placeholder="you@email.com"
            />
          </div>
          <div className={ui.field}>
            <label className={ui.label}>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={ui.input}
              placeholder="Min. 8 characters"
            />
          </div>
          {error && <div className={ui.alertError}>{error}</div>}
          <Button type="submit" disabled={submitting} fullWidth>
            {submitting ? "Creating..." : "Create account"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            fullWidth
            onClick={() => navigate("/login")}
          >
            Already have an account? Sign in
          </Button>
        </form>
      </div>
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
    <AppShell title="Bookings" subtitle="Your upcoming and past performances">
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <section className={ui.formSection}>
          <h3 className={ui.formSectionTitle}>Upcoming</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              {
                title: "Jazz Night",
                date: "Jan 28",
                venue: "Blue Note Lounge",
                status: "confirmed",
                pay: "$300",
              },
              {
                title: "Private Party",
                date: "Feb 2",
                venue: "Skyline Rooftop",
                status: "confirmed",
                pay: "$450",
              },
            ].map((b, i) => (
              <div key={i} className={ui.lineItem}>
                <div style={{ flex: 1 }}>
                  <p className={ui.lineItemTitle}>{b.title}</p>
                  <p className={ui.lineItemMeta}>
                    {b.date} · {b.venue}
                  </p>
                </div>
                <span
                  className={
                    b.status === "confirmed" ? ui.badgeSuccess : ui.badgeWarning
                  }
                >
                  {b.status}
                </span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{b.pay}</span>
              </div>
            ))}
          </div>
        </section>
        <section className={ui.formSection}>
          <h3 className={ui.formSectionTitle}>Past performances</h3>
          <div className={ui.empty}>
            <p className={ui.emptyTitle}>No past bookings yet</p>
            <p className={ui.emptyText}>Completed gigs will appear here.</p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function PerksPage() {
  return (
    <AppShell title="Perks" subtitle="Rewards and benefits you've earned">
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <section className={ui.formSection} style={{ textAlign: "center" }}>
          <p className={ui.formSectionTitle}>Your tier</p>
          <p
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: "var(--primary)",
              margin: "8px 0",
            }}
          >
            Silver
          </p>
          <p className={ui.formSectionDesc}>
            Complete 5 more gigs with 4.5+ rating to reach Gold
          </p>
          <div
            style={{
              width: "100%",
              maxWidth: 400,
              margin: "16px auto 0",
              height: 8,
              borderRadius: 999,
              background: "var(--surface-2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: "60%",
                height: "100%",
                borderRadius: 999,
                background: "var(--primary)",
              }}
            />
          </div>
          <p className={ui.help} style={{ marginTop: 8 }}>
            12 / 20 qualifying gigs
          </p>
        </section>
        <section className={ui.formSection}>
          <h3 className={ui.formSectionTitle}>Your perks</h3>
          {[
            {
              icon: "🎸",
              name: "Free rental credit",
              detail: "1 day free per month",
              active: true,
            },
            {
              icon: "🎨",
              name: "Embroidery discount",
              detail: "20% off branding",
              active: true,
            },
            {
              icon: "🎤",
              name: "Priority bookings",
              detail: "4.5+ rating required",
              active: false,
            },
          ].map((perk, i) => (
            <div
              key={i}
              className={ui.lineItem}
              style={{ opacity: perk.active ? 1 : 0.5 }}
            >
              <span style={{ fontSize: 24 }}>{perk.icon}</span>
              <div style={{ flex: 1 }}>
                <p className={ui.lineItemTitle}>{perk.name}</p>
                <p className={ui.lineItemMeta}>{perk.detail}</p>
              </div>
              <span className={perk.active ? ui.badgeSuccess : ui.badgeNeutral}>
                {perk.active ? "Active" : "Locked"}
              </span>
            </div>
          ))}
        </section>
      </div>
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
            <Route path="/onboarding" element={<MusicianOnboardingPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/" element={<MusicianLandingPage />} />
            <Route
              path="/dashboard"
              element={
                <RequireMusician>
                  <DashboardPage />
                </RequireMusician>
              }
            />
            <Route
              path="/bookings"
              element={
                <RequireMusician>
                  <BookingsPage />
                </RequireMusician>
              }
            />
            <Route
              path="/perks"
              element={
                <RequireMusician>
                  <PerksPage />
                </RequireMusician>
              }
            />
            <Route
              path="/gigs"
              element={
                <RequireMusician>
                  <BrowseGigsPage />
                </RequireMusician>
              }
            />
            <Route
              path="/gigs/:id"
              element={
                <RequireMusician>
                  <GigDetailPage />
                </RequireMusician>
              }
            />

            <Route
              path="/rentals"
              element={
                <RequireMusician>
                  <RentalsPage />
                </RequireMusician>
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
                <RequireMusician>
                  <ProfilePage />
                </RequireMusician>
              }
            />
          </Routes>
        </div>
      </div>
    </AppFrame>
  );
}

export default App;
