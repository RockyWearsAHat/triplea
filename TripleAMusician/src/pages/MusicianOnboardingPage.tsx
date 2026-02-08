import { useEffect, useMemo, useState, useCallback } from "react";
import type { StripeOnboardingStatus } from "@shared";
import { AppShell, Button, useAuth } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import { useNavigate } from "react-router-dom";
import { createApiClient } from "../lib/urls";
import { StripeOnboardingForm } from "../components/StripeOnboardingForm";

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/* Step indicator component */
function StepProgress({
  currentStep,
  steps,
}: {
  currentStep: number;
  steps: string[];
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        width: "100%",
        maxWidth: 520,
        margin: "0 auto 32px",
      }}
    >
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentStep;
        const isComplete = stepNum < currentStep;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              flex: 1,
              position: "relative",
            }}
          >
            {i < steps.length - 1 && (
              <div
                style={{
                  position: "absolute",
                  top: 16,
                  left: "50%",
                  width: "100%",
                  height: 2,
                  background: isComplete ? "var(--success)" : "var(--border)",
                  zIndex: 1,
                }}
              />
            )}
            <div style={{ position: "relative", zIndex: 3 }}>
              {/* Solid background blocker */}
              <div
                style={{
                  position: "absolute",
                  top: -4,
                  left: -4,
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "#000000",
                  zIndex: -1,
                }}
              />
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  background: isComplete
                    ? "var(--success)"
                    : isActive
                      ? "var(--primary)"
                      : "var(--surface)",
                  border: `2px solid ${isComplete ? "var(--success)" : isActive ? "var(--primary)" : "var(--border)"}`,
                  color:
                    isComplete || isActive
                      ? isComplete
                        ? "white"
                        : "var(--primary-contrast)"
                      : "var(--text-muted)",
                  position: "relative",
                  transition: "all 200ms ease",
                }}
              >
                {isComplete ? "✓" : stepNum}
              </div>
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: isActive ? 600 : 500,
                color: isActive
                  ? "var(--primary)"
                  : isComplete
                    ? "var(--success)"
                    : "var(--text-muted)",
                textAlign: "center",
              }}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function MusicianOnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const api = useMemo(() => createApiClient(), []);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [stripeStatus, setStripeStatus] =
    useState<StripeOnboardingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Stripe submit handler
  const [stripeSubmitFn, setStripeSubmitFn] = useState<
    (() => Promise<void>) | null
  >(null);
  const [stripeValid, setStripeValid] = useState(false);

  // Stable callbacks to prevent infinite loops
  const handleStripeValidationChange = useCallback((isValid: boolean) => {
    setStripeValid(isValid);
  }, []);

  const handleStripeSubmitReady = useCallback((fn: () => Promise<void>) => {
    setStripeSubmitFn(() => fn);
  }, []);

  // Form fields
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

  const stripeReady =
    !!stripeStatus?.chargesEnabled && !!stripeStatus?.payoutsEnabled;

  // Determine current step based on what user has filled out
  const hasStripeInfo = stripeReady;
  const stripeComplete = hasStripeInfo || stripeValid;
  const hasProfile = instruments.trim() && genres.trim() && bio.trim();
  const profileReady = hasProfile;
  const onboardingReady = stripeComplete && hasProfile;

  const currentStep = stripeComplete ? (hasProfile ? 3 : 2) : 1;

  const handleCompleteOnboarding = async () => {
    setBusy(true);
    setError(null);

    try {
      // Step 1: Submit Stripe onboarding if needed
      if (!hasStripeInfo && stripeSubmitFn) {
        await stripeSubmitFn();
      }

      // Step 2: Save profile
      await api.updateMyMusicianProfile({
        instruments: parseList(instruments),
        genres: parseList(genres),
        bio: bio.trim() || undefined,
        defaultHourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
        acceptsDirectRequests,
      });

      // Step 3: Navigate to dashboard
      navigate("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to complete onboarding.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      title="Get started"
      subtitle="Complete these steps to go live as a performer"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleCompleteOnboarding();
        }}
        style={{ maxWidth: 640, width: "100%", margin: "0 auto" }}
      >
        {/* Step Progress */}
        <StepProgress
          currentStep={currentStep}
          steps={["Payouts", "Profile", "Go Live"]}
        />

        {/* Contiguous form card with sections */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: 24,
          }}
        >
          <div style={{ padding: 24, borderBottom: "1px solid var(--border)" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <h2 className={ui.formSectionTitle}>
                {stripeComplete ? "✓ " : "1. "}Connect payouts
              </h2>
              {stripeComplete && (
                <span className={ui.badgeSuccess}>Complete</span>
              )}
            </div>
            <p className={ui.formSectionDesc} style={{ marginBottom: 16 }}>
              Connect payouts so you can receive payments automatically after
              each gig.
            </p>
            {!hasStripeInfo && user?.stripeAccountId ? (
              <StripeOnboardingForm
                accountId={user.stripeAccountId}
                onSuccess={() => window.location.reload()}
                onValidationChange={handleStripeValidationChange}
                onSubmitReady={handleStripeSubmitReady}
              />
            ) : hasStripeInfo ? (
              <p className={ui.help}>✓ Stripe account connected and ready</p>
            ) : (
              <p className={ui.help}>Setting up your Stripe account...</p>
            )}
          </div>

          <div style={{ padding: 24 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <h2 className={ui.formSectionTitle}>
                {profileReady ? "✓ " : "2. "}Performer profile
              </h2>
              {profileReady && (
                <span className={ui.badgeSuccess}>Complete</span>
              )}
            </div>
            <p className={ui.formSectionDesc} style={{ marginBottom: 16 }}>
              Let hosts know what you play and the styles you specialize in.
            </p>

            <div className={ui.field}>
              <label className={ui.label}>Instruments</label>
              <input
                className={ui.input}
                value={instruments}
                onChange={(e) => setInstruments(e.target.value)}
                placeholder="Drums, Piano, Vocals"
              />
              <span className={ui.help}>
                Separate multiple instruments with commas
              </span>
            </div>

            <div className={ui.field}>
              <label className={ui.label}>Genres</label>
              <input
                className={ui.input}
                value={genres}
                onChange={(e) => setGenres(e.target.value)}
                placeholder="Jazz, Gospel, Pop"
              />
            </div>

            <div className={ui.field}>
              <label className={ui.label}>Bio</label>
              <textarea
                className={ui.input}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A short professional bio about your experience and style"
                rows={4}
                style={{ resize: "vertical" }}
              />
            </div>

            <div className={ui.field}>
              <label className={ui.label}>Hourly rate (optional)</label>
              <input
                className={ui.input}
                type="number"
                min={0}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="150"
              />
              <span className={ui.help}>
                Your default rate — can be adjusted per gig
              </span>
            </div>

            <label className={ui.checkboxLabel}>
              <input
                type="checkbox"
                className={ui.checkbox}
                checked={acceptsDirectRequests}
                onChange={(e) => setAcceptsDirectRequests(e.target.checked)}
              />
              Accept direct requests from hosts
            </label>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div
            className={ui.error}
            style={{ marginBottom: 24, fontSize: "14px" }}
          >
            {error}
          </div>
        )}

        {/* Single Submit Button */}
        <Button
          type="submit"
          disabled={!onboardingReady || busy}
          size="lg"
          style={{ width: "100%", marginTop: 8 }}
        >
          {busy ? "Completing setup..." : "Complete setup →"}
        </Button>

        {loading && (
          <p className={ui.help} style={{ textAlign: "center", marginTop: 16 }}>
            Loading onboarding details…
          </p>
        )}
      </form>
    </AppShell>
  );
}

export default MusicianOnboardingPage;
