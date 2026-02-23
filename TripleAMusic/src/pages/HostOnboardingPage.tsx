import { useEffect, useMemo, useState, useCallback } from "react";
import type { StripeOnboardingStatus } from "@shared";
import { AppShell, Button, useAuth, StripeOnboardingForm } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import { useNavigate } from "react-router-dom";
import { createApiClient } from "../lib/urls";

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

export function HostOnboardingPage() {
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

  // Host-specific fields
  // Venues: support multiple venues per host
  const [venues, setVenues] = useState<
    Array<{
      id?: string;
      name: string;
      address?: string;
      capacity?: number | null;
      images?: File[]; // local previews until uploaded
      imageCount?: number;
      uploadStatus?: "idle" | "uploading" | "uploaded" | "failed" | "pending";
    }>
  >([]);

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  // per-venue payout email handled on each venue

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [stripe, myLocations] = await Promise.all([
          api.getMusicianStripeStatus(),
          api.listMyStageLocations(),
        ]);
        if (cancelled) return;
        setStripeStatus(stripe);
        setVenues(
          (myLocations || []).map((l) => ({
            id: l.id,
            name: l.name,
            address: l.address,
            capacity: l.seatCapacity ?? null,
            imageCount: l.imageCount ?? 0,
            uploadStatus: "uploaded",
          })),
        );
      } catch {
        // ignore — first-time hosts won't have a stripe status yet
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [api, user]);

  // Venue CRUD helpers
  const addVenue = () => {
    setVenues((s) => [
      ...s,
      {
        name: "",
        address: "",
        capacity: null,
        images: [],
        uploadStatus: "idle",
        imageCount: 0,
      },
    ]);
  };

  const updateVenue = (
    index: number,
    patch: Partial<(typeof venues)[number]>,
  ) => {
    setVenues((s) => s.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  };

  const removeVenue = (index: number) => {
    setVenues((s) => s.filter((_, i) => i !== index));
  };

  const handleImageFiles = (index: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    updateVenue(index, { images: arr, uploadStatus: "pending" });
  };

  if (!user) {
    return (
      <AppShell title="Host onboarding" centered>
        <div className={ui.help} style={{ textAlign: "center" }}>
          Please sign in to continue.
        </div>
      </AppShell>
    );
  }

  const stripeReady =
    !!stripeStatus?.chargesEnabled && !!stripeStatus?.payoutsEnabled;

  const hasStripeInfo = stripeReady;
  const stripeComplete = hasStripeInfo || stripeValid;
  const hasVenueInfo =
    venues.length > 0 &&
    venues.every((v) => v.name.trim() && (v.address ?? "").trim());
  const onboardingReady = stripeComplete && hasVenueInfo;

  const currentStep = stripeComplete ? (hasVenueInfo ? 3 : 2) : 1;

  const handleCompleteOnboarding = async () => {
    setBusy(true);
    setError(null);

    try {
      // Step 1: Submit Stripe onboarding if needed
      if (!hasStripeInfo && stripeSubmitFn) {
        await stripeSubmitFn();
      }

      // Step 2: Create any new locations on the server
      // create and upload images per-venue sequentially
      for (let i = 0; i < venues.length; i++) {
        const v = venues[i];
        // mark uploading
        if (v.uploadStatus === "pending")
          updateVenue(i, { uploadStatus: "uploading" });

        let createdId = v.id;
        if (!createdId) {
          const created = await api.createStageLocation({
            name: v.name,
            address: v.address,
          });
          createdId = created.id;
          updateVenue(i, { id: createdId });
        }

        // if there are images selected, upload them
        if (v.images && v.images.length && createdId) {
          try {
            const res = await api.uploadLocationImages(createdId, v.images);
            updateVenue(i, { uploadStatus: "uploaded", imageCount: res.total });
          } catch (err) {
            updateVenue(i, { uploadStatus: "failed" });
            // do not abort entire onboarding; log and continue
            // eslint-disable-next-line no-console
            console.error("Image upload failed for venue", v.name, err);
          }
        }
      }

      // Keep a lightweight profile update so host account is flagged as set up
      await api.updateMyMusicianProfile({
        instruments: [],
        genres: [],
        bio: `Host with ${venues.length} venue(s)`,
      });

      // Step 3: Navigate to manage page
      navigate("/manage");
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
      title="Host setup"
      subtitle="Complete these steps to start selling tickets and hosting events"
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
          steps={["Payouts", "Venue", "Go Live"]}
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
          {/* Section 1: Stripe / Payouts */}
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
              Connect payouts so you can receive ticket sale revenue directly to
              your bank.
            </p>
            {!hasStripeInfo && user?.stripeAccountId ? (
              <StripeOnboardingForm
                accountId={user.stripeAccountId}
                apiClient={api}
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

          {/* Section 2: Venue & Settings */}
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
                {hasVenueInfo ? "✓ " : "2. "}Venue & settings
              </h2>
              {hasVenueInfo && (
                <span className={ui.badgeSuccess}>Complete</span>
              )}
            </div>
            <p className={ui.formSectionDesc} style={{ marginBottom: 16 }}>
              Add one or more venues you manage. You can upload images and
              customize seating later.
            </p>

            {venues.map((v, i) => (
              <div
                key={i}
                className={`${ui.card} ${ui.cardPad}`}
                style={{ marginBottom: 12 }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedIndex(expandedIndex === i ? null : i)
                      }
                      style={{
                        all: "unset",
                        cursor: "pointer",
                        display: "block",
                        width: "100%",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: 15 }}>
                            {v.name || "New venue"}
                          </strong>
                          <div
                            style={{ fontSize: 12, color: "var(--text-muted)" }}
                          >
                            {v.address || "No address yet"}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 12 }}>
                            {v.uploadStatus === "uploading"
                              ? "Uploading…"
                              : v.uploadStatus === "failed"
                                ? "Upload failed"
                                : v.imageCount
                                  ? `${v.imageCount} image(s)`
                                  : "No images"}
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                  <div>
                    <Button variant="danger" onClick={() => removeVenue(i)}>
                      Remove
                    </Button>
                  </div>
                </div>

                {expandedIndex === i && (
                  <div style={{ marginTop: 12 }}>
                    <div className={ui.field}>
                      <label className={ui.label}>Venue name</label>
                      <input
                        className={ui.input}
                        value={v.name}
                        onChange={(e) =>
                          updateVenue(i, { name: e.target.value })
                        }
                        placeholder="e.g., The Blue Note"
                      />
                    </div>

                    <div className={ui.field}>
                      <label className={ui.label}>Address</label>
                      <input
                        className={ui.input}
                        value={v.address ?? ""}
                        onChange={(e) =>
                          updateVenue(i, { address: e.target.value })
                        }
                        placeholder="Street, city, state"
                      />
                    </div>

                    <div style={{ display: "flex", gap: 12 }}>
                      <div style={{ flex: 1 }} className={ui.field}>
                        <label className={ui.label}>Capacity (optional)</label>
                        <input
                          type="number"
                          className={ui.input}
                          min={0}
                          value={v.capacity ?? ""}
                          onChange={(e) =>
                            updateVenue(i, {
                              capacity: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                          placeholder="200"
                        />
                        <span className={ui.help}>
                          Maximum number of guests
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                      <div style={{ flex: 1 }}>
                        <label className={ui.label} style={{ marginBottom: 6 }}>
                          Images
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => handleImageFiles(i, e.target.files)}
                        />

                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            marginTop: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          {(v.images || []).map((f, idx) => (
                            <img
                              key={idx}
                              src={URL.createObjectURL(f)}
                              alt={f.name}
                              style={{
                                width: 72,
                                height: 48,
                                objectFit: "cover",
                                borderRadius: 6,
                              }}
                            />
                          ))}
                        </div>

                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <Button
                            variant="secondary"
                            onClick={() =>
                              v.id && navigate(`/venues/${v.id}/seating`)
                            }
                            disabled={!v.id}
                          >
                            Customize seating
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <Button type="button" onClick={addVenue}>
                + Add venue
              </Button>
              <Button variant="secondary" onClick={() => navigate("/manage")}>
                Manage venues
              </Button>
            </div>
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

export default HostOnboardingPage;
