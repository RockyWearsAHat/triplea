import { useEffect, useMemo, useState } from "react";
import type { MusicianProfile, StripeOnboardingStatus } from "@shared";
import { AppShell, Button, spacing, useAuth } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import { useNavigate } from "react-router-dom";
import { createApiClient } from "../lib/urls";

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function MusicianOnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const api = useMemo(() => createApiClient(), []);

  const [loading, setLoading] = useState(true);
  const [stripeStatus, setStripeStatus] =
    useState<StripeOnboardingStatus | null>(null);
  const [profile, setProfile] = useState<MusicianProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stripeBusy, setStripeBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);

  const [instruments, setInstruments] = useState("");
  const [genres, setGenres] = useState("");
  const [bio, setBio] = useState("");
  const [hourlyRate, setHourlyRate] = useState<string>("");
  const [acceptsDirectRequests, setAcceptsDirectRequests] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [stripe, profileRes] = await Promise.all([
          api.getMusicianStripeStatus(),
          api.getMyMusicianProfile(),
        ]);
        if (cancelled) return;
        setStripeStatus(stripe);
        setProfile(profileRes);
        setInstruments(profileRes.instruments.join(", "));
        setGenres(profileRes.genres.join(", "));
        setBio(profileRes.bio ?? "");
        setHourlyRate(
          typeof profileRes.defaultHourlyRate === "number"
            ? String(profileRes.defaultHourlyRate)
            : "",
        );
        setAcceptsDirectRequests(!!profileRes.acceptsDirectRequests);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load onboarding details.",
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

  if (!user) {
    return (
      <AppShell title="Musician onboarding" centered>
        <div className={ui.help} style={{ textAlign: "center" }}>
          Please sign in to continue.
        </div>
      </AppShell>
    );
  }

  if (!user.role.includes("musician")) {
    return (
      <AppShell title="Musician onboarding" centered>
        <div
          className={[ui.card, ui.cardPad].join(" ")}
          style={{ maxWidth: 520, width: "100%", textAlign: "center" }}
        >
          <h2 className={ui.sectionTitle}>Enable musician access first</h2>
          <p className={ui.help}>
            This account isn&apos;t enabled for musician access yet.
          </p>
          <Button onClick={() => navigate("/")}>Back to home</Button>
        </div>
      </AppShell>
    );
  }

  const stripeReady =
    !!stripeStatus?.chargesEnabled && !!stripeStatus?.payoutsEnabled;
  const profileReady =
    (profile?.instruments?.length ?? 0) > 0 &&
    (profile?.genres?.length ?? 0) > 0 &&
    !!profile?.bio?.trim();
  const onboardingReady = stripeReady && profileReady;

  async function handleStartStripe() {
    setStripeBusy(true);
    setError(null);
    try {
      const link = await api.getMusicianStripeOnboardingLink();
      window.location.assign(link.url);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to open Stripe onboarding.",
      );
      setStripeBusy(false);
    }
  }

  async function refreshStripeStatus() {
    setStripeBusy(true);
    setError(null);
    try {
      const stripe = await api.getMusicianStripeStatus();
      setStripeStatus(stripe);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to refresh Stripe status.",
      );
    } finally {
      setStripeBusy(false);
    }
  }

  async function handleSaveProfile() {
    setProfileBusy(true);
    setError(null);
    try {
      const updated = await api.updateMyMusicianProfile({
        instruments: parseList(instruments),
        genres: parseList(genres),
        bio: bio.trim() || undefined,
        defaultHourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
        acceptsDirectRequests,
      });
      setProfile(updated);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save profile details.",
      );
    } finally {
      setProfileBusy(false);
    }
  }

  return (
    <AppShell title="Musician onboarding" subtitle="Get paid and go live">
      <div className={ui.stack} style={{ gap: spacing.lg }}>
        {error && <p className={ui.error}>{error}</p>}

        <section
          className={[ui.card, ui.cardPad].join(" ")}
          style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}
        >
          <div>
            <h2 className={ui.sectionTitle} style={{ marginBottom: 4 }}>
              Step 1: Connect payouts (Stripe)
            </h2>
            <p className={ui.help}>
              Set up your Stripe account so we can pay you automatically.
            </p>
          </div>
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            <Button onClick={handleStartStripe} disabled={stripeBusy}>
              {stripeStatus?.stripeAccountId
                ? stripeBusy
                  ? "Opening..."
                  : "Continue Stripe setup"
                : stripeBusy
                  ? "Opening..."
                  : "Start Stripe setup"}
            </Button>
            <Button
              variant="secondary"
              onClick={refreshStripeStatus}
              disabled={stripeBusy}
            >
              {stripeBusy ? "Checking..." : "Check status"}
            </Button>
          </div>
          <div className={ui.help}>
            Status: {stripeReady ? "Connected" : "Not finished"}
          </div>
          {stripeStatus?.requirements?.length ? (
            <div className={ui.help}>
              Stripe still needs: {stripeStatus.requirements.join(", ")}
            </div>
          ) : null}
        </section>

        <section
          className={[ui.card, ui.cardPad].join(" ")}
          style={{ display: "flex", flexDirection: "column", gap: spacing.md }}
        >
          <div>
            <h2 className={ui.sectionTitle} style={{ marginBottom: 4 }}>
              Step 2: Performer profile
            </h2>
            <p className={ui.help}>
              Tell hosts what you play and the genres you specialize in.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing.sm,
            }}
          >
            <label style={{ fontSize: 13 }}>
              Instruments (comma separated)
            </label>
            <input
              className={ui.input}
              value={instruments}
              onChange={(e) => setInstruments(e.target.value)}
              placeholder="Drums, Piano, Vocals"
            />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing.sm,
            }}
          >
            <label style={{ fontSize: 13 }}>Genres (comma separated)</label>
            <input
              className={ui.input}
              value={genres}
              onChange={(e) => setGenres(e.target.value)}
              placeholder="Jazz, Gospel, Pop"
            />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing.sm,
            }}
          >
            <label style={{ fontSize: 13 }}>Bio</label>
            <textarea
              className={ui.input}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Short professional bio"
              rows={4}
            />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing.sm,
            }}
          >
            <label style={{ fontSize: 13 }}>
              Default hourly rate (optional)
            </label>
            <input
              className={ui.input}
              type="number"
              min={0}
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="150"
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={acceptsDirectRequests}
              onChange={(e) => setAcceptsDirectRequests(e.target.checked)}
            />
            <span style={{ fontSize: 13 }}>Accept direct requests</span>
          </label>
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            <Button onClick={handleSaveProfile} disabled={profileBusy}>
              {profileBusy ? "Saving..." : "Save profile"}
            </Button>
            <div className={ui.help}>
              Status: {profileReady ? "Complete" : "Not finished"}
            </div>
          </div>
        </section>

        <section
          className={[ui.card, ui.cardPad].join(" ")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.md,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 className={ui.sectionTitle} style={{ marginBottom: 4 }}>
              Step 3: Finish
            </h2>
            <p className={ui.help}>
              You can access the musician dashboard after payouts and profile
              are set up.
            </p>
          </div>
          <Button
            onClick={() => navigate("/dashboard")}
            disabled={!onboardingReady}
          >
            Go to dashboard
          </Button>
        </section>

        {loading && <p className={ui.help}>Loading onboarding details…</p>}
      </div>
    </AppShell>
  );
}

export default MusicianOnboardingPage;
