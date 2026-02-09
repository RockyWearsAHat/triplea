import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Event, Gig, GigApplication, MusicianProfile } from "@shared";
import {
  AppFrame,
  AppShell,
  Button,
  spacing,
  RequireAnyRole,
  RequireRole,
  useScrollReveal,
  useAuth,
  useSafeBack,
} from "@shared";
import {
  Route,
  Routes,
  Navigate,
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import "./App.css";
import ui from "@shared/styles/primitives.module.scss";
import { NavBar } from "./components/NavBar";
import ConcertMarketplacePage from "./pages/ConcertMarketplacePage";
import ConcertDetailPage from "./pages/ConcertDetailPage";
import TicketConfirmationPage from "./pages/TicketConfirmationPage";
import MyTicketsPage from "./pages/MyTicketsPage";
import TicketScannerPage from "./pages/TicketScannerPage";
import ManagePage from "./pages/ManagePage";
import MyGigsPage from "./pages/MyGigsPage";
import VenuesPage from "./pages/VenuesPage";
import VenueSeatingLayoutsPage from "./pages/VenueSeatingLayoutsPage";
import SeatLayoutEditorPage from "./pages/SeatLayoutEditorPage";
import StaffPage from "./pages/StaffPage";
import StaffJoinPage from "./pages/StaffJoinPage";
import CheckoutPage from "./pages/CheckoutPage";
import CartPage from "./pages/CartPage";
import AccountPage from "./pages/AccountPage";
import EventTicketsPage from "./pages/EventTicketsPage";
import HostOnboardingPage from "./pages/HostOnboardingPage";
import { CartProvider } from "./context/CartContext";
import { createApiClient } from "./lib/urls";

import { ChatInbox } from "@shared";

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

const MUSICIAN_ORIGIN = "http://localhost:5175";

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
    <AppShell title="Sign in" centered>
      <form
        onSubmit={handleSubmit}
        className={ui.formSection}
        style={{ maxWidth: 400, width: "100%" }}
      >
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <h2 className={ui.formSectionTitle}>Welcome back</h2>
          <p className={ui.formSectionDesc}>Sign in to Triple A Music</p>
        </div>

        <div className={ui.field}>
          <label className={ui.label}>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={ui.input}
            placeholder="you@example.com"
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
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => navigate("/forgot-password")}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontSize: 13,
              color: "var(--primary)",
              cursor: "pointer",
              alignSelf: "flex-end",
              marginTop: 2,
            }}
          >
            Forgot password?
          </button>
        </div>

        {error && <p className={ui.alertError}>{error}</p>}
        {user && (
          <p className={ui.help}>
            {user.email}
            {!isCustomer &&
              hasAnyRole &&
              " · This account is not set up as a host yet."}
          </p>
        )}

        <Button type="submit" disabled={submitting} style={{ width: "100%" }}>
          {submitting ? "Signing in..." : "Sign in"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate("/register")}
          style={{ width: "100%" }}
        >
          Create an account
        </Button>

        <div className={ui.divider} />
        <p className={ui.help} style={{ textAlign: "center" }}>
          Looking to perform?{" "}
          <a
            href={`${MUSICIAN_ORIGIN}/login`}
            style={{ color: "var(--primary)", textDecoration: "underline" }}
          >
            Musician portal
          </a>
        </p>
      </form>
    </AppShell>
  );
}

function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const intent = searchParams.get("intent");
  const isHostIntent = intent === "host";
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
      const roles = isHostIntent ? ["customer", "host"] : ["customer"];
      await register({ name, email, password, roles });
      if (isHostIntent) {
        navigate("/dashboard");
      } else {
        navigate("/");
      }
    } catch (err) {
      setError("Registration failed. Please try a different email.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="Create account" centered>
      <form
        onSubmit={handleSubmit}
        className={ui.formSection}
        style={{ maxWidth: 400, width: "100%" }}
      >
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <h2 className={ui.formSectionTitle}>Join Triple A Music</h2>
          <p className={ui.formSectionDesc}>
            {isHostIntent
              ? "Create a host account to post events"
              : "Create your account"}
          </p>
        </div>

        <div className={ui.field}>
          <label className={ui.label}>Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={ui.input}
            placeholder="Your name"
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
            placeholder="you@example.com"
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
            placeholder="••••••••"
          />
        </div>

        {error && <p className={ui.alertError}>{error}</p>}

        <Button type="submit" disabled={submitting} style={{ width: "100%" }}>
          {submitting ? "Creating..." : "Create account"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate("/login")}
          style={{ width: "100%" }}
        >
          Back to sign in
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

  const api = useMemo(() => createApiClient(), []);

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
          className={ui.formSection}
          style={{ maxWidth: 400, width: "100%", textAlign: "center" }}
        >
          <div style={{ fontSize: 48, marginBottom: 8 }}>📧</div>
          <p className={ui.formSectionTitle}>Check your inbox</p>
          <p className={ui.formSectionDesc}>
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
              gap: 8,
              marginTop: 16,
            }}
          >
            <Button
              onClick={() => setSuccess(false)}
              variant="ghost"
              style={{ width: "100%" }}
            >
              Try a different email
            </Button>
            <Button
              onClick={() => navigate("/login")}
              style={{ width: "100%" }}
            >
              Back to sign in
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Reset password" centered>
      <form
        onSubmit={handleSubmit}
        className={ui.formSection}
        style={{ maxWidth: 400, width: "100%" }}
      >
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <h2 className={ui.formSectionTitle}>Forgot your password?</h2>
          <p className={ui.formSectionDesc}>
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        <div className={ui.field}>
          <label className={ui.label}>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={ui.input}
            autoFocus
            placeholder="you@example.com"
          />
        </div>

        {error && <p className={ui.alertError}>{error}</p>}

        <Button type="submit" disabled={submitting} style={{ width: "100%" }}>
          {submitting ? "Sending..." : "Send reset link"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate("/login")}
          style={{ width: "100%" }}
        >
          Back to sign in
        </Button>
      </form>
    </AppShell>
  );
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const api = useMemo(() => createApiClient(), []);

  if (!token) {
    return (
      <AppShell title="Invalid link" centered>
        <div
          className={ui.formSection}
          style={{ maxWidth: 400, width: "100%", textAlign: "center" }}
        >
          <div style={{ fontSize: 48, marginBottom: 8 }}>⚠️</div>
          <p className={ui.formSectionTitle}>Invalid or expired link</p>
          <p className={ui.formSectionDesc}>
            This password reset link is invalid or has expired.
          </p>
          <p className={ui.help}>Please request a new password reset link.</p>
          <Button
            onClick={() => navigate("/forgot-password")}
            style={{ width: "100%", marginTop: 8 }}
          >
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
          className={ui.formSection}
          style={{ maxWidth: 400, width: "100%", textAlign: "center" }}
        >
          <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
          <p className={ui.formSectionTitle}>All set!</p>
          <p className={ui.formSectionDesc}>
            Your password has been reset successfully.
          </p>
          <Button
            onClick={() => navigate("/login")}
            style={{ width: "100%", marginTop: 8 }}
          >
            Sign in
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="New password" centered>
      <form
        onSubmit={handleSubmit}
        className={ui.formSection}
        style={{ maxWidth: 400, width: "100%" }}
      >
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <h2 className={ui.formSectionTitle}>Create new password</h2>
          <p className={ui.formSectionDesc}>Enter your new password below.</p>
        </div>

        <div className={ui.field}>
          <label className={ui.label}>New password</label>
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={ui.input}
            autoFocus
            placeholder="••••••••"
          />
          <p className={ui.help}>Minimum 8 characters</p>
        </div>

        <div className={ui.field}>
          <label className={ui.label}>Confirm password</label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={ui.input}
            placeholder="••••••••"
          />
        </div>

        {error && <p className={ui.alertError}>{error}</p>}

        <Button type="submit" disabled={submitting} style={{ width: "100%" }}>
          {submitting ? "Resetting..." : "Reset password"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate("/login")}
          style={{ width: "100%" }}
        >
          Back to sign in
        </Button>
      </form>
    </AppShell>
  );
}

function BrowsePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const api = useMemo(() => createApiClient(), []);
  // Removed unused state: query, city, when
  const [gigs, setGigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  useScrollReveal(contentRef, [gigs.length, loading]);

  useEffect(() => {
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
    <div ref={contentRef}>
      {/* Hero - Full viewport, one bold message */}
      <section className={ui.heroFull}>
        <p className={ui.heroKicker}>Triple A Music</p>
        <h1 className={ui.heroMassive}>Everything around the gig — handled.</h1>
        <p className={ui.heroSubtitleLarge}>
          Find concerts, book performers, or get on stage. One platform for live
          music.
        </p>
        <div className={ui.heroActionsLarge}>
          <Button
            size="lg"
            onClick={() =>
              document
                .getElementById("music-concerts")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            Browse concerts
          </Button>
          <Button
            size="lg"
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
            size="lg"
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
            <Button
              size="lg"
              variant="ghost"
              onClick={() => navigate("/login")}
            >
              Sign in
            </Button>
          ) : null}
        </div>
      </section>

      {/* Feature highlights - clean section */}
      <section className={ui.sectionFullCenter}>
        <h2 className={ui.sectionTitleLarge}>Everything you need</h2>
        <p className={ui.sectionLead}>
          Focus on the music. We handle the rest.
        </p>

        <div className={ui.pathGrid} style={{ marginTop: 40 }}>
          <div className={ui.pathCard}>
            <p className={ui.pathCardTitle}>Concerts</p>
            <p className={ui.pathCardDesc}>
              Discover and buy tickets for upcoming events in your city.
            </p>
          </div>
          <div className={ui.pathCard}>
            <p className={ui.pathCardTitle}>Performers</p>
            <p className={ui.pathCardDesc}>
              Book musicians, browse profiles, and see ratings.
            </p>
          </div>
          <div className={ui.pathCard}>
            <p className={ui.pathCardTitle}>Host tools</p>
            <p className={ui.pathCardDesc}>
              Post gigs, manage bookings, and message artists.
            </p>
          </div>
        </div>
      </section>

      {/* Results grid - concerts and performers */}
      <section className={ui.sectionFull}>
        <div id="music-concerts" />
        <Section title="Upcoming concerts">
          {loading ? (
            <p className={ui.help}>Loading...</p>
          ) : error ? (
            <p className={ui.alertError}>{error}</p>
          ) : gigs.length === 0 ? (
            <div className={ui.empty}>
              <p className={ui.emptyTitle}>No concerts yet</p>
              <p className={ui.emptyText}>
                Check back soon for upcoming events.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {gigs.map((gig) => (
                <div
                  key={gig.id}
                  data-reveal
                  className={ui.lineItem}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/gigs/${gig.id}`)}
                >
                  <div style={{ flex: 1 }}>
                    <p className={ui.lineItemTitle}>{gig.title}</p>
                    <p className={ui.lineItemMeta}>
                      {gig.date} · {gig.city}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/gigs/${gig.id}`);
                    }}
                  >
                    View
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Section>
      </section>
    </div>
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
    <AppShell title="Ratings & reviews" subtitle="Your review history">
      <div className={ui.formSection}>
        <div className={ui.empty}>
          <p className={ui.emptyTitle}>No ratings yet</p>
          <p className={ui.emptyText}>
            After attending events or working with musicians, your ratings and
            reviews will appear here.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

/* TicketsPage, EventsPage, and MyGigsPage removed - functionality consolidated into ManagePage */

// Removed unused AccountPage

/**
 * Gate component that redirects hosts to /onboarding if Stripe payouts aren't set up.
 */
function HostSetupGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !(user.stripeChargesEnabled && user.stripePayoutsEnabled)) {
      navigate("/onboarding", { replace: true });
    }
  }, [user, navigate]);

  if (!user) return null;
  if (!(user.stripeChargesEnabled && user.stripePayoutsEnabled)) return null;

  return <>{children}</>;
}

function MusicianDetailsPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const api = useMemo(() => createApiClient(), []);

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
                            !Number.isNaN(resolvedBudget) ||
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

/** Host seating configuration page */
function GigSeatingConfigPage() {
  const api = useMemo(() => createApiClient(), []);
  const { id } = useParams();
  const gigId = id ?? "";
  const goBack = useSafeBack("/my-gigs");
  const navigate = useNavigate();

  const [gig, setGig] = useState<Gig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  type SeatingLayoutSummary = {
    id: string;
    name: string;
    description?: string;
    totalCapacity: number;
    isTemplate: boolean;
    stagePosition?: "top" | "bottom" | "left" | "right";
  };

  const [venueLayouts, setVenueLayouts] = useState<SeatingLayoutSummary[]>([]);
  const [venueLayoutsLoading, setVenueLayoutsLoading] = useState(false);
  const [venueLayoutsError, setVenueLayoutsError] = useState<string | null>(
    null,
  );

  const [currentLayout, setCurrentLayout] = useState<null | {
    id: string;
    name: string;
    totalCapacity: number;
    updatedAt?: string;
  }>(null);
  const [currentLayoutLoading, setCurrentLayoutLoading] = useState(false);

  const [busyTemplateId, setBusyTemplateId] = useState<string | null>(null);
  const [templateActionError, setTemplateActionError] = useState<string | null>(
    null,
  );

  // Form state
  const [seatingType, setSeatingType] = useState<
    "general_admission" | "reserved"
  >("general_admission");
  const [seatCapacity, setSeatCapacity] = useState<number | "">("");
  const [hasTicketTiers, setHasTicketTiers] = useState(false);

  // Ticket tiers state
  const [tiers, setTiers] = useState<
    Array<{
      id?: string;
      name: string;
      description: string;
      tierType: "ga" | "vip" | "premium" | "reserved";
      price: number;
      capacity: number;
    }>
  >([]);
  const [tierError, setTierError] = useState<string | null>(null);

  // Load gig data
  useEffect(() => {
    if (!gigId) {
      setError("Missing gig ID");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        const gigData = await api.getPublicGig(gigId);
        if (cancelled) return;
        setGig(gigData);
        setSeatingType(
          (gigData.seatingType as "general_admission" | "reserved") ||
            "general_admission",
        );
        setSeatCapacity(gigData.seatCapacity ?? "");
        setHasTicketTiers(gigData.hasTicketTiers ?? false);

        // Fetch tiers if gig has them
        if (gigData.hasTicketTiers) {
          try {
            const tiersData = await api.getGigTicketTiers(gigId);
            if (!cancelled && tiersData.tiers) {
              setTiers(
                tiersData.tiers.map((t) => ({
                  id: t.id,
                  name: t.name,
                  description: t.description || "",
                  tierType: t.tierType as "ga" | "vip" | "premium" | "reserved",
                  price: t.price,
                  capacity: t.capacity,
                })),
              );
            }
          } catch {
            // Tiers not available yet
          }
        }

        // Fetch venue templates (if the gig is attached to a location)
        const locationId = gigData.location?.id;
        if (locationId) {
          setVenueLayoutsLoading(true);
          setVenueLayoutsError(null);
          api
            .listLocationSeatingLayouts(locationId)
            .then((r) => {
              if (cancelled) return;
              setVenueLayouts(r.layouts as SeatingLayoutSummary[]);
            })
            .catch((e) => {
              if (cancelled) return;
              setVenueLayoutsError(e instanceof Error ? e.message : String(e));
            })
            .finally(() => {
              if (cancelled) return;
              setVenueLayoutsLoading(false);
            });
        }

        // Fetch current layout (if the gig already has reserved seating attached)
        if (gigData.seatingLayoutId) {
          setCurrentLayoutLoading(true);
          api
            .getSeatingLayout(gigData.seatingLayoutId)
            .then((r) => {
              if (cancelled) return;
              setCurrentLayout({
                id: r.layout.id,
                name: r.layout.name,
                totalCapacity: r.layout.totalCapacity,
                updatedAt: r.layout.updatedAt,
              });
              setSeatCapacity(r.layout.totalCapacity);
            })
            .catch(() => {
              // Layout may not be accessible, or not yet created
            })
            .finally(() => {
              if (cancelled) return;
              setCurrentLayoutLoading(false);
            });
        } else {
          setCurrentLayout(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [api, gigId]);

  // Save seating config
  const handleSave = async () => {
    if (!gigId) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const result = await api.updateGigSeatingConfig(gigId, {
        seatingType,
        seatCapacity: seatCapacity === "" ? undefined : Number(seatCapacity),
      });
      setGig((prev) =>
        prev
          ? {
              ...prev,
              seatingType: result.gig.seatingType as Gig["seatingType"],
              seatCapacity: result.gig.seatCapacity,
              seatingLayoutId: result.gig.seatingLayoutId,
            }
          : prev,
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleApplyTemplateToGig = async (templateLayoutId: string) => {
    if (!gigId) return;
    if (!gig?.location?.id) {
      setTemplateActionError("This gig has no venue yet.");
      return;
    }

    setTemplateActionError(null);

    if (gig.seatingLayoutId) {
      const ok = window.confirm(
        "This will replace the current seat map for this gig. Continue?",
      );
      if (!ok) return;
    }

    setBusyTemplateId(templateLayoutId);
    try {
      const result = await api.cloneTemplateLayoutToGig(
        gigId,
        templateLayoutId,
      );
      const newLayout = result.layout;

      setSeatingType("reserved");
      setSeatCapacity(newLayout.totalCapacity);
      setGig((prev) =>
        prev
          ? {
              ...prev,
              seatingType: "reserved",
              seatCapacity: newLayout.totalCapacity,
              seatingLayoutId: newLayout.id,
            }
          : prev,
      );
      setCurrentLayout({
        id: newLayout.id,
        name: newLayout.name,
        totalCapacity: newLayout.totalCapacity,
      });
    } catch (e) {
      setTemplateActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyTemplateId(null);
    }
  };

  // Add a new tier
  const addTier = () => {
    setTiers((prev) => [
      ...prev,
      {
        name: "",
        description: "",
        tierType: "ga" as const,
        price: 0,
        capacity: 0,
      },
    ]);
  };

  // Save a tier
  const saveTier = async (index: number) => {
    const tier = tiers[index];
    if (!tier.name.trim()) {
      setTierError("Tier name is required");
      return;
    }
    setTierError(null);

    try {
      if (tier.id) {
        // Update existing tier
        await api.updateTicketTier(tier.id, {
          name: tier.name,
          description: tier.description,
          price: tier.price,
          capacity: tier.capacity,
        });
      } else {
        // Create new tier
        const result = await api.createTicketTier(gigId, {
          name: tier.name,
          description: tier.description,
          tierType: tier.tierType,
          price: tier.price,
          capacity: tier.capacity,
        });
        // Update local state with the new ID
        setTiers((prev) =>
          prev.map((t, i) => (i === index ? { ...t, id: result.tier.id } : t)),
        );
      }
    } catch (e) {
      setTierError(e instanceof Error ? e.message : String(e));
    }
  };

  // Delete a tier
  const deleteTier = async (index: number) => {
    const tier = tiers[index];
    if (tier.id) {
      try {
        await api.deleteTicketTier(tier.id);
      } catch (e) {
        setTierError(e instanceof Error ? e.message : String(e));
        return;
      }
    }
    setTiers((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <AppShell title="Configure seating" subtitle="Loading...">
        <p className={ui.help}>Loading gig details...</p>
      </AppShell>
    );
  }

  if (error || !gig) {
    return (
      <AppShell title="Configure seating" subtitle="Error">
        <p className={ui.error}>{error || "Gig not found"}</p>
        <Button variant="secondary" onClick={goBack}>
          ← Back
        </Button>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={`Configure: ${gig.title}`}
      subtitle="Set seating type, capacity, and ticket tiers"
    >
      <div
        className={ui.stack}
        style={{ "--stack-gap": "24px", maxWidth: 600 } as React.CSSProperties}
      >
        {/* Seating Type */}
        <Section title="Seating type">
          <div style={{ display: "flex", gap: spacing.md, flexWrap: "wrap" }}>
            <label
              className={[ui.card, ui.cardPad].join(" ")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: spacing.sm,
                cursor: "pointer",
                border:
                  seatingType === "general_admission"
                    ? "2px solid var(--primary)"
                    : undefined,
                flex: 1,
                minWidth: 200,
              }}
            >
              <input
                type="radio"
                name="seatingType"
                value="general_admission"
                checked={seatingType === "general_admission"}
                onChange={() => setSeatingType("general_admission")}
              />
              <div>
                <p style={{ fontWeight: 600, margin: 0 }}>General Admission</p>
                <p className={ui.help} style={{ margin: 0, fontSize: 13 }}>
                  First-come, first-served. No reserved seats.
                </p>
              </div>
            </label>
            <label
              className={[ui.card, ui.cardPad].join(" ")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: spacing.sm,
                cursor: "pointer",
                border:
                  seatingType === "reserved"
                    ? "2px solid var(--primary)"
                    : undefined,
                flex: 1,
                minWidth: 200,
              }}
            >
              <input
                type="radio"
                name="seatingType"
                value="reserved"
                checked={seatingType === "reserved"}
                onChange={() => setSeatingType("reserved")}
              />
              <div>
                <p style={{ fontWeight: 600, margin: 0 }}>Reserved Seating</p>
                <p className={ui.help} style={{ margin: 0, fontSize: 13 }}>
                  Customers select specific seats at checkout.
                </p>
              </div>
            </label>
          </div>
        </Section>

        {/* Reserved seating seat map */}
        {seatingType === "reserved" && (
          <Section title="Seat map">
            {!gig.location?.id ? (
              <p className={ui.error} style={{ margin: 0 }}>
                Set a venue for this gig before configuring reserved seats.
              </p>
            ) : (
              <div
                className={ui.stack}
                style={{ "--stack-gap": "12px" } as React.CSSProperties}
              >
                {templateActionError ? (
                  <p className={ui.error} style={{ margin: 0 }}>
                    {templateActionError}
                  </p>
                ) : null}

                <div className={[ui.card, ui.cardPad].join(" ")}>
                  <div
                    style={{
                      display: "flex",
                      gap: spacing.md,
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ flex: "1 1 240px" }}>
                      <p style={{ fontWeight: 600, margin: 0 }}>
                        Current seat map
                      </p>
                      {currentLayoutLoading ? (
                        <p
                          className={ui.help}
                          style={{ margin: 0, fontSize: 13 }}
                        >
                          Loading seat map...
                        </p>
                      ) : gig.seatingLayoutId ? (
                        <p
                          className={ui.help}
                          style={{ margin: 0, fontSize: 13 }}
                        >
                          {currentLayout?.name ?? "Seat map"} · Capacity:{" "}
                          {currentLayout?.totalCapacity ??
                            gig.seatCapacity ??
                            "—"}
                        </p>
                      ) : (
                        <p
                          className={ui.help}
                          style={{ margin: 0, fontSize: 13 }}
                        >
                          No seat map applied yet.
                        </p>
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: spacing.sm,
                        alignItems: "center",
                      }}
                    >
                      <Button
                        variant="secondary"
                        disabled={!gig.seatingLayoutId}
                        onClick={() =>
                          navigate(
                            `/venues/${encodeURIComponent(
                              gig.location!.id,
                            )}/seating/${encodeURIComponent(
                              gig.seatingLayoutId || "",
                            )}`,
                          )
                        }
                      >
                        Edit seat map
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          navigate(
                            `/venues/${encodeURIComponent(
                              gig.location!.id,
                            )}/seating`,
                          )
                        }
                      >
                        Manage venue maps
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <p style={{ fontWeight: 600, margin: 0 }}>Apply a template</p>
                  <p className={ui.help} style={{ marginTop: 4, fontSize: 13 }}>
                    Choose a venue seat map template to clone onto this gig.
                  </p>

                  {venueLayoutsLoading ? (
                    <p
                      className={ui.help}
                      style={{ fontSize: 13, marginTop: 8 }}
                    >
                      Loading templates...
                    </p>
                  ) : venueLayoutsError ? (
                    <p
                      className={ui.error}
                      style={{ fontSize: 13, marginTop: 8 }}
                    >
                      {venueLayoutsError}
                    </p>
                  ) : venueLayouts.filter((l) => l.isTemplate).length === 0 ? (
                    <p
                      className={ui.help}
                      style={{ fontSize: 13, marginTop: 8 }}
                    >
                      No templates yet. Create one in “Manage venue maps”.
                    </p>
                  ) : (
                    <div
                      className={ui.stack}
                      style={
                        {
                          "--stack-gap": "10px",
                          marginTop: 8,
                        } as React.CSSProperties
                      }
                    >
                      {venueLayouts
                        .filter((l) => l.isTemplate)
                        .map((l) => (
                          <div
                            key={l.id}
                            className={[ui.card, ui.cardPad].join(" ")}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: spacing.md,
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ flex: "1 1 240px" }}>
                              <p style={{ margin: 0, fontWeight: 600 }}>
                                {l.name}
                              </p>
                              <p
                                className={ui.help}
                                style={{ margin: 0, fontSize: 13 }}
                              >
                                Capacity: {l.totalCapacity}
                                {l.description ? ` · ${l.description}` : ""}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              disabled={busyTemplateId === l.id}
                              onClick={() => handleApplyTemplateToGig(l.id)}
                            >
                              {busyTemplateId === l.id
                                ? "Applying..."
                                : "Use template"}
                            </Button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </Section>
        )}

        {/* Seat Capacity */}
        <Section title="Seat capacity">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing.sm,
            }}
          >
            <input
              type="number"
              min={1}
              value={seatCapacity}
              disabled={
                seatingType === "reserved" &&
                Boolean(gig.seatingLayoutId) &&
                Boolean(currentLayout?.totalCapacity)
              }
              onChange={(e) =>
                setSeatCapacity(
                  e.target.value === "" ? "" : Number(e.target.value),
                )
              }
              placeholder="Enter total seats"
              className={ui.input}
              style={{ maxWidth: 200 }}
            />
            <p className={ui.help} style={{ fontSize: 13, margin: 0 }}>
              {seatingType === "reserved" && gig.seatingLayoutId
                ? "For reserved seating, capacity is derived from the seat map."
                : "Maximum number of tickets that can be sold. Leave empty for unlimited."}
            </p>
          </div>
        </Section>

        {/* Ticket Tiers */}
        <Section title="Ticket tiers">
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing.sm,
              marginBottom: spacing.md,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={hasTicketTiers}
              onChange={(e) => setHasTicketTiers(e.target.checked)}
            />
            <span>Enable tiered pricing (GA, VIP, Premium, etc.)</span>
          </label>

          {hasTicketTiers && (
            <div
              className={ui.stack}
              style={{ "--stack-gap": "12px" } as React.CSSProperties}
            >
              {tierError && <p className={ui.error}>{tierError}</p>}

              {tiers.map((tier, index) => (
                <div
                  key={tier.id || index}
                  className={[ui.card, ui.cardPad].join(" ")}
                  style={{
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
                    <input
                      type="text"
                      value={tier.name}
                      onChange={(e) =>
                        setTiers((prev) =>
                          prev.map((t, i) =>
                            i === index ? { ...t, name: e.target.value } : t,
                          ),
                        )
                      }
                      placeholder="Tier name (e.g. VIP)"
                      className={ui.input}
                      style={{ flex: 1, minWidth: 120 }}
                    />
                    <select
                      value={tier.tierType}
                      onChange={(e) =>
                        setTiers((prev) =>
                          prev.map((t, i) =>
                            i === index
                              ? {
                                  ...t,
                                  tierType: e.target.value as
                                    | "ga"
                                    | "vip"
                                    | "premium"
                                    | "reserved",
                                }
                              : t,
                          ),
                        )
                      }
                      className={ui.input}
                      style={{ width: 120 }}
                    >
                      <option value="ga">General</option>
                      <option value="vip">VIP</option>
                      <option value="premium">Premium</option>
                      <option value="reserved">Reserved</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    value={tier.description}
                    onChange={(e) =>
                      setTiers((prev) =>
                        prev.map((t, i) =>
                          i === index
                            ? { ...t, description: e.target.value }
                            : t,
                        ),
                      )
                    }
                    placeholder="Description (optional)"
                    className={ui.input}
                  />
                  <div
                    style={{
                      display: "flex",
                      gap: spacing.sm,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      <label
                        style={{ fontSize: 12, color: "var(--text-muted)" }}
                      >
                        Price ($)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={tier.price}
                        onChange={(e) =>
                          setTiers((prev) =>
                            prev.map((t, i) =>
                              i === index
                                ? { ...t, price: Number(e.target.value) }
                                : t,
                            ),
                          )
                        }
                        className={ui.input}
                        style={{ width: 100 }}
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      <label
                        style={{ fontSize: 12, color: "var(--text-muted)" }}
                      >
                        Capacity
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={tier.capacity || ""}
                        onChange={(e) =>
                          setTiers((prev) =>
                            prev.map((t, i) =>
                              i === index
                                ? {
                                    ...t,
                                    capacity:
                                      e.target.value === ""
                                        ? 0
                                        : Number(e.target.value),
                                  }
                                : t,
                            ),
                          )
                        }
                        placeholder="Unlimited"
                        className={ui.input}
                        style={{ width: 100 }}
                      />
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: spacing.sm,
                      marginTop: spacing.xs,
                    }}
                  >
                    <Button size="sm" onClick={() => saveTier(index)}>
                      {tier.id ? "Update" : "Save"} tier
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteTier(index)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}

              <Button variant="secondary" onClick={addTier}>
                + Add tier
              </Button>
            </div>
          )}
        </Section>

        {/* Save button */}
        <div
          style={{
            display: "flex",
            gap: spacing.md,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save configuration"}
          </Button>
          {saveSuccess && (
            <span
              style={{
                color: "var(--success)",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              ✓ Saved!
            </span>
          )}
          {saveError && <span className={ui.error}>{saveError}</span>}
        </div>

        <Button variant="ghost" onClick={goBack}>
          ← Back
        </Button>
      </div>
    </AppShell>
  );
}

function GigApplicantsPage() {
  const api = useMemo(() => createApiClient(), []);
  const { id } = useParams();
  const gigId = id ?? "";
  const goBack = useSafeBack("/my-gigs");

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
      <Button variant="ghost" onClick={goBack}>
        ← Back
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

function App() {
  return (
    <CartProvider>
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
              <p className={ui.subtitle}>Concert marketplace</p>
            </header>
            <NavBar />
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Routes>
              <Route path="/" element={<ConcertMarketplacePage />} />
              <Route path="/concerts/:id" element={<ConcertDetailPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route
                path="/tickets/:code"
                element={<TicketConfirmationPage />}
              />
              <Route path="/browse" element={<BrowsePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/musicians/:id" element={<MusicianDetailsPage />} />
              <Route
                path="/onboarding"
                element={
                  <RequireRole role="customer">
                    <HostOnboardingPage />
                  </RequireRole>
                }
              />
              <Route
                path="/manage"
                element={
                  <RequireRole role="customer">
                    <HostSetupGate>
                      <ManagePage />
                    </HostSetupGate>
                  </RequireRole>
                }
              />
              {/* Legacy route - redirect to /manage */}
              <Route
                path="/dashboard"
                element={
                  <RequireRole role="customer">
                    <ManagePage />
                  </RequireRole>
                }
              />
              {/* Host dashboard section pages */}
              <Route
                path="/my-gigs"
                element={
                  <RequireRole role="customer">
                    <MyGigsPage />
                  </RequireRole>
                }
              />
              <Route
                path="/venues"
                element={
                  <RequireRole role="customer">
                    <VenuesPage />
                  </RequireRole>
                }
              />
              <Route
                path="/venues/:locationId/seating"
                element={
                  <RequireRole role="customer">
                    <VenueSeatingLayoutsPage />
                  </RequireRole>
                }
              />
              <Route
                path="/venues/:locationId/seating/:layoutId"
                element={
                  <RequireRole role="customer">
                    <SeatLayoutEditorPage />
                  </RequireRole>
                }
              />
              <Route
                path="/staff"
                element={
                  <RequireRole role="customer">
                    <StaffPage />
                  </RequireRole>
                }
              />
              {/* Staff join page - public route for accepting invites */}
              <Route path="/staff/join/:token" element={<StaffJoinPage />} />
              {/* Legacy routes */}
              <Route
                path="/events"
                element={<Navigate to="/my-gigs" replace />}
              />
              <Route
                path="/tickets"
                element={<Navigate to="/my-gigs" replace />}
              />
              <Route
                path="/my-tickets"
                element={
                  <RequireRole role="customer">
                    <MyTicketsPage />
                  </RequireRole>
                }
              />
              <Route
                path="/scan-tickets"
                element={
                  <RequireRole role="customer">
                    <TicketScannerPage />
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
                path="/gigs/:id/applicants"
                element={
                  <RequireRole role="customer">
                    <GigApplicantsPage />
                  </RequireRole>
                }
              />
              <Route
                path="/gigs/:id/seating"
                element={
                  <RequireRole role="customer">
                    <GigSeatingConfigPage />
                  </RequireRole>
                }
              />
              <Route
                path="/gigs/:gigId/tickets"
                element={
                  <RequireRole role="customer">
                    <EventTicketsPage />
                  </RequireRole>
                }
              />
            </Routes>
          </div>
        </div>
      </AppFrame>
    </CartProvider>
  );
}

export default App;
