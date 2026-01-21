import React from "react";
import type {
  ArtistRequest,
  Booking,
  Gig,
  MusicianProfile,
  Perk,
} from "@shared";
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
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        display: "inline-flex",
        flexDirection: "column",
        gap: 2,
        minWidth: 120,
      }}
    >
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
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
function MusicianDashboardPage() {
  const api = React.useMemo(
    () => new TripleAApiClient({ baseUrl: "http://localhost:4000/api" }),
    [],
  );
  const { user } = useAuth();
  const navigate = useNavigate();
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  useScrollReveal(contentRef);

  const [profileLoading, setProfileLoading] = React.useState(false);
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [defaultRateInput, setDefaultRateInput] = React.useState<string>("");
  const [acceptsDirect, setAcceptsDirect] = React.useState(false);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [profileSaved, setProfileSaved] = React.useState<string | null>(null);

  const [requests, setRequests] = React.useState<ArtistRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = React.useState(false);
  const [requestsError, setRequestsError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user) return;
    setProfileError(null);
    setProfileLoading(true);
    api
      .getMyMusicianProfile()
      .then((m) => {
        if (
          typeof m.defaultHourlyRate === "number" &&
          m.defaultHourlyRate > 0
        ) {
          setDefaultRateInput(String(m.defaultHourlyRate));
        } else {
          setDefaultRateInput("");
        }
        setAcceptsDirect(Boolean(m.acceptsDirectRequests));
      })
      .catch((e) => setProfileError(e instanceof Error ? e.message : String(e)))
      .finally(() => setProfileLoading(false));
  }, [api, user]);

  React.useEffect(() => {
    if (!user) return;
    setRequestsError(null);
    setRequestsLoading(true);
    api
      .listMyArtistRequests()
      .then((r) => setRequests(r))
      .catch((e) =>
        setRequestsError(e instanceof Error ? e.message : String(e)),
      )
      .finally(() => setRequestsLoading(false));
  }, [api, user]);

  async function handleSaveDirectSettings(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileSaved(null);
    setSavingProfile(true);
    try {
      const rate = defaultRateInput.trim()
        ? Number(defaultRateInput.trim())
        : null;
      if (rate !== null && (!Number.isFinite(rate) || rate <= 0)) {
        throw new Error("Default hourly rate must be a positive number.");
      }

      const updated = await api.updateMyMusicianProfile({
        defaultHourlyRate: rate,
        acceptsDirectRequests: acceptsDirect,
      });
      void updated;
      setProfileSaved("Saved.");
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : "Failed to save settings",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <AppShell
      title="Dashboard"
      subtitle="Today’s gigs, requests, and perks in one place."
    >
      <div
        ref={contentRef}
        style={{ display: "flex", flexDirection: "column", gap: spacing.xl }}
      >
        <section className={ui.hero} data-reveal>
          <div>
            <p className={ui.heroKicker}>Performer work app</p>
            <h2 className={ui.heroTitle}>Run your gigs like a pro.</h2>
            <p className={ui.heroLead}>
              Track bookings and obligations, apply to new gigs, and build your
              rating and perks — all with the same account across Triple A.
            </p>
            <div className={ui.heroActions}>
              <Button
                variant="secondary"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                View dashboard
              </Button>
              <Button onClick={() => navigate("/gigs")}>Browse gigs</Button>
            </div>
          </div>

          <div className={ui.featureGrid}>
            <div className={ui.featureCard} data-reveal>
              <p className={ui.featureTitle}>Bookings & obligations</p>
              <p className={ui.featureBody}>
                See what’s next, confirm arrival, and keep details handy.
              </p>
            </div>
            <div className={ui.featureCard} data-reveal>
              <p className={ui.featureTitle}>Gigs marketplace</p>
              <p className={ui.featureBody}>
                Browse open gigs and apply with a short message.
              </p>
            </div>
            <div className={ui.featureCard} data-reveal>
              <p className={ui.featureTitle}>Perks & reputation</p>
              <p className={ui.featureBody}>
                Improve your rating over time and unlock better perks.
              </p>
            </div>
          </div>
        </section>

        <Section title="Profile & rating">
          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.lg }}>
            <div style={{ flex: "1 1 220px" }}>
              <h3 style={{ fontSize: 20, fontWeight: 600 }}>
                {user?.name ?? "Your profile"}
              </h3>
              <p className={ui.help} style={{ marginTop: spacing.sm }}>
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
                data-reveal
                className={[ui.card, ui.cardPad].join(" ")}
                style={{
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
                data-reveal
                className={[ui.card, ui.cardPad].join(" ")}
                style={{
                  border: "1px dashed var(--border-strong)",
                }}
              >
                <h3 style={{ fontWeight: 600 }}>{perk.name}</h3>
                <p
                  style={{
                    marginTop: spacing.xs,
                    fontSize: 14,
                  }}
                  className={ui.help}
                >
                  {perk.description}
                </p>
                <p
                  style={{
                    marginTop: spacing.sm,
                    fontSize: 13,
                  }}
                  className={ui.help}
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

        <Section title="Direct requests & pricing">
          {profileLoading ? (
            <p className={ui.help}>Loading...</p>
          ) : !user ? (
            <p className={ui.help}>
              Sign in as a musician to manage direct request settings.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: spacing.md,
                maxWidth: 520,
              }}
            >
              <form
                onSubmit={handleSaveDirectSettings}
                className={[ui.card, ui.cardPad].join(" ")}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: spacing.sm,
                }}
              >
                <p className={ui.help}>
                  Set your default hourly rate and whether hosts can request you
                  directly from Triple A Music. A gig must already have a
                  stage/location before a host can send a request.
                </p>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  <label style={{ fontSize: 13 }}>
                    Default hourly rate (USD)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={defaultRateInput}
                    onChange={(e) => setDefaultRateInput(e.target.value)}
                    placeholder="e.g. 120"
                    className={ui.input}
                  />
                </div>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: spacing.sm,
                    fontSize: 14,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={acceptsDirect}
                    onChange={(e) => setAcceptsDirect(e.target.checked)}
                  />
                  Allow direct booking requests from hosts
                </label>
                {profileError && <p className={ui.error}>{profileError}</p>}
                {profileSaved && (
                  <p style={{ fontSize: 13, color: "var(--accent)" }}>
                    {profileSaved}
                  </p>
                )}
                <Button type="submit" disabled={savingProfile}>
                  {savingProfile ? "Saving..." : "Save settings"}
                </Button>
              </form>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: spacing.sm,
                }}
              >
                <h3 style={{ fontSize: 14, fontWeight: 600 }}>
                  Incoming requests
                </h3>
                {requestsLoading ? (
                  <p className={ui.help}>Loading...</p>
                ) : requestsError ? (
                  <p className={ui.error}>{requestsError}</p>
                ) : requests.length === 0 ? (
                  <p className={ui.help}>No direct requests yet.</p>
                ) : (
                  requests.map((r) => (
                    <div
                      key={r.id}
                      className={[ui.card, ui.cardPad].join(" ")}
                      style={{ fontSize: 13 }}
                    >
                      <div>
                        Offer: ${r.priceOffered.toFixed(0)} · Status: {r.status}
                      </div>
                      {r.createdAt && (
                        <div className={ui.help}>
                          Requested at {new Date(r.createdAt).toLocaleString()}
                        </div>
                      )}
                      {r.status === "pending" && (
                        <div
                          style={{
                            marginTop: spacing.xs,
                            display: "flex",
                            gap: spacing.sm,
                          }}
                        >
                          <Button
                            variant="secondary"
                            onClick={async () => {
                              try {
                                await api.decideArtistRequest({
                                  id: r.id,
                                  decision: "accept",
                                });
                                setRequests((prev) =>
                                  prev.map((req) =>
                                    req.id === r.id
                                      ? { ...req, status: "accepted" }
                                      : req,
                                  ),
                                );
                              } catch (e) {
                                setRequestsError(
                                  e instanceof Error
                                    ? e.message
                                    : "Failed to accept request",
                                );
                              }
                            }}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={async () => {
                              try {
                                await api.decideArtistRequest({
                                  id: r.id,
                                  decision: "decline",
                                });
                                setRequests((prev) =>
                                  prev.map((req) =>
                                    req.id === r.id
                                      ? { ...req, status: "declined" }
                                      : req,
                                  ),
                                );
                              } catch (e) {
                                setRequestsError(
                                  e instanceof Error
                                    ? e.message
                                    : "Failed to decline request",
                                );
                              }
                            }}
                          >
                            Decline
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
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
                  <label style={{ fontSize: 13, color: "#9ca3af" }}>
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
      {user?.role.includes("musician") && (
        <>
          <NavLink
            to="/"
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
            <h1 className={ui.title}>Triple A Musician</h1>
            <p className={ui.subtitle}>Performer work app</p>
          </header>
          <NavBar />
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
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
