import { useEffect, useMemo, useState } from "react";
import type { Location } from "@shared";
import { Button, spacing } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import { useNavigate, useParams } from "react-router-dom";
import { HostDashboardShell } from "../components/HostDashboardShell";
import { createApiClient, getAssetUrl } from "../lib/urls";

type SectionDraft = {
  name: string;
  rows: number;
  seatsPerRow: number;
};

export function VenueSeatingLayoutsPage() {
  const { locationId } = useParams();
  const navigate = useNavigate();
  const api = useMemo(() => createApiClient(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [layouts, setLayouts] = useState<
    Array<{
      id: string;
      name: string;
      description?: string;
      totalCapacity: number;
      isTemplate: boolean;
      stagePosition?: "top" | "bottom" | "left" | "right";
    }>
  >([]);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [layoutName, setLayoutName] = useState("Main seating");
  const [layoutDesc, setLayoutDesc] = useState("");
  const [stagePosition, setStagePosition] = useState<
    "top" | "bottom" | "left" | "right"
  >("top");
  const [sections, setSections] = useState<SectionDraft[]>([
    { name: "Main", rows: 10, seatsPerRow: 12 },
  ]);
  const [useGenerator, setUseGenerator] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!locationId) return;
      setLoading(true);
      setError(null);
      try {
        const [myLocations, layoutsRes] = await Promise.all([
          api.listMyStageLocations(),
          api.listLocationSeatingLayouts(locationId),
        ]);
        if (cancelled) return;
        setLocation(myLocations.find((l) => l.id === locationId) ?? null);
        setLayouts(layoutsRes.layouts);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [api, locationId]);

  async function handleCreate() {
    if (!locationId) return;
    setCreating(true);
    setCreateError(null);
    try {
      await api.createLocationSeatingLayout(locationId, {
        name: layoutName.trim() || "Seating",
        description: layoutDesc.trim() || undefined,
        stagePosition,
        useSimpleLayout: useGenerator,
        sections: useGenerator
          ? sections
              .map((s) => ({
                name: s.name.trim(),
                rows: Number(s.rows) || 0,
                seatsPerRow: Number(s.seatsPerRow) || 0,
              }))
              .filter((s) => s.name && s.rows > 0 && s.seatsPerRow > 0)
          : undefined,
      });

      const next = await api.listLocationSeatingLayouts(locationId);
      setLayouts(next.layouts);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  function updateSection(idx: number, patch: Partial<SectionDraft>) {
    setSections((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    );
  }

  function removeSection(idx: number) {
    setSections((prev) => prev.filter((_, i) => i !== idx));
  }

  if (loading) {
    return (
      <HostDashboardShell title="Venue seating" subtitle="Loading...">
        <p className={ui.help}>Loading seating layouts…</p>
      </HostDashboardShell>
    );
  }

  return (
    <HostDashboardShell
      title="Venue seating"
      subtitle={
        location
          ? `Build and maintain seat maps for ${location.name}`
          : "Build and maintain seat maps"
      }
    >
      <div
        style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}
      >
        {error ? <p className={ui.error}>{error}</p> : null}

        {location ? (
          <div
            className={[ui.card, ui.cardPad].join(" ")}
            style={{
              display: "flex",
              gap: spacing.md,
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{ display: "flex", gap: spacing.md, alignItems: "center" }}
            >
              {location.imageUrl ? (
                <img
                  src={getAssetUrl(location.imageUrl)}
                  alt=""
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 10,
                    objectFit: "cover",
                    border: "1px solid var(--border)",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 10,
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                  }}
                >
                  🏛️
                </div>
              )}
              <div>
                <div className={ui.cardTitle}>{location.name}</div>
                <div className={ui.cardText}>
                  {[location.address, location.city].filter(Boolean).join(", ")}
                </div>
              </div>
            </div>
            <Button variant="secondary" onClick={() => navigate("/venues")}>
              Back to venues
            </Button>
          </div>
        ) : null}

        <section className={ui.section}>
          <h2 className={ui.sectionTitle}>Create a layout</h2>
          <div className={[ui.card, ui.cardPad].join(" ")}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: spacing.md,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label className={ui.help}>Layout name</label>
                <input
                  className={ui.input}
                  value={layoutName}
                  onChange={(e) => setLayoutName(e.target.value)}
                  placeholder="Main seating"
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label className={ui.help}>Stage position</label>
                <select
                  className={ui.input}
                  value={stagePosition}
                  onChange={(e) =>
                    setStagePosition(e.target.value as typeof stagePosition)
                  }
                >
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>

            <div
              style={{
                marginTop: spacing.md,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <label className={ui.help}>Description (optional)</label>
              <input
                className={ui.input}
                value={layoutDesc}
                onChange={(e) => setLayoutDesc(e.target.value)}
                placeholder="Example: Standard setup for concerts"
              />
            </div>

            <div
              style={{
                marginTop: spacing.md,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <input
                id="useGenerator"
                type="checkbox"
                checked={useGenerator}
                onChange={(e) => setUseGenerator(e.target.checked)}
              />
              <label htmlFor="useGenerator" className={ui.help}>
                Generate seats from sections (recommended)
              </label>
            </div>

            {useGenerator ? (
              <div
                style={{
                  marginTop: spacing.md,
                  display: "flex",
                  flexDirection: "column",
                  gap: spacing.md,
                }}
              >
                {sections.map((s, idx) => (
                  <div
                    key={idx}
                    className={[ui.card, ui.cardPad].join(" ")}
                    style={{ background: "var(--surface-2)" }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.2fr 0.6fr 0.6fr auto",
                        gap: spacing.md,
                        alignItems: "center",
                      }}
                    >
                      <input
                        className={ui.input}
                        value={s.name}
                        onChange={(e) =>
                          updateSection(idx, { name: e.target.value })
                        }
                        placeholder="Section name"
                      />
                      <input
                        className={ui.input}
                        type="number"
                        min={1}
                        value={s.rows}
                        onChange={(e) =>
                          updateSection(idx, { rows: Number(e.target.value) })
                        }
                        placeholder="Rows"
                      />
                      <input
                        className={ui.input}
                        type="number"
                        min={1}
                        value={s.seatsPerRow}
                        onChange={(e) =>
                          updateSection(idx, {
                            seatsPerRow: Number(e.target.value),
                          })
                        }
                        placeholder="Seats/row"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSection(idx)}
                        disabled={sections.length <= 1}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}

                <div style={{ display: "flex", gap: spacing.sm }}>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setSections((prev) => [
                        ...prev,
                        { name: "Balcony", rows: 6, seatsPerRow: 10 },
                      ])
                    }
                  >
                    Add section
                  </Button>
                </div>
              </div>
            ) : (
              <p className={ui.help} style={{ marginTop: spacing.md }}>
                Create an empty layout, then open the editor to place seats.
              </p>
            )}

            {createError ? (
              <p className={ui.error} style={{ marginTop: spacing.md }}>
                {createError}
              </p>
            ) : null}

            <div
              style={{
                marginTop: spacing.md,
                display: "flex",
                gap: spacing.sm,
                justifyContent: "flex-end",
              }}
            >
              <Button onClick={handleCreate} disabled={creating || !locationId}>
                {creating ? "Creating…" : "Create layout"}
              </Button>
            </div>
          </div>
        </section>

        <section className={ui.section}>
          <h2 className={ui.sectionTitle}>Your layouts</h2>

          {layouts.length === 0 ? (
            <p className={ui.help}>No layouts yet.</p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: spacing.md,
              }}
            >
              {layouts.map((l) => (
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
                  <div style={{ minWidth: 220 }}>
                    <div className={ui.cardTitle}>{l.name}</div>
                    <div className={ui.cardText}>
                      Capacity: <strong>{l.totalCapacity}</strong>
                      {l.stagePosition ? ` · Stage: ${l.stagePosition}` : ""}
                      {l.isTemplate ? " · Template" : ""}
                    </div>
                    {l.description ? (
                      <div className={ui.help} style={{ marginTop: 6 }}>
                        {l.description}
                      </div>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", gap: spacing.sm }}>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        navigate(
                          `/venues/${encodeURIComponent(locationId || "")}/seating/${encodeURIComponent(l.id)}`,
                        )
                      }
                    >
                      Edit seat map
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </HostDashboardShell>
  );
}

export default VenueSeatingLayoutsPage;
