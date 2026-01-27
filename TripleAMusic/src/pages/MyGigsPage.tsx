import React, { useEffect, useMemo, useState } from "react";
import type { Gig, Location } from "@shared";
import { Button } from "@shared";
import { useNavigate, Link } from "react-router-dom";
import ui from "@shared/styles/primitives.module.scss";
import { createApiClient } from "../lib/urls";
import { HostDashboardShell } from "../components/HostDashboardShell";
import styles from "./MyGigsPage.module.scss";
import { Plus, ChevronDown, ChevronUp, Settings } from "lucide-react";

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function MyGigsPage() {
  const api = useMemo(() => createApiClient(), []);
  const navigate = useNavigate();

  // State for data
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [venues, setVenues] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // Gig creation
  const [showGigForm, setShowGigForm] = useState(false);
  const [gigTitle, setGigTitle] = useState("");
  const [gigDescription, setGigDescription] = useState("");
  const [gigDate, setGigDate] = useState("");
  const [gigTime, setGigTime] = useState("");
  const [gigBudget, setGigBudget] = useState<number | "">("");
  const [gigLocationId, setGigLocationId] = useState("");
  const [gigBusy, setGigBusy] = useState(false);
  const [gigError, setGigError] = useState<string | null>(null);
  const [gigSuccess, setGigSuccess] = useState(false);

  // Expanded gig cards for inline editing
  const [expandedGigId, setExpandedGigId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.listMyGigs().catch(() => []),
      api.listMyStageLocations().catch(() => []),
    ])
      .then(([gigsData, venuesData]) => {
        setGigs(gigsData);
        setVenues(venuesData);
      })
      .finally(() => setLoading(false));
  }, [api]);

  async function handleCreateGig(e: React.FormEvent) {
    e.preventDefault();
    setGigError(null);
    setGigBusy(true);
    setGigSuccess(false);
    try {
      const created = await api.createGig({
        title: gigTitle,
        description: gigDescription || undefined,
        date: gigDate,
        time: gigTime || undefined,
        budget: gigBudget === "" ? undefined : Number(gigBudget),
        locationId: gigLocationId || undefined,
      });
      // Add to local state
      setGigs((prev) => [
        {
          id: created.id,
          title: created.title,
          description: created.description,
          date: created.date,
          time: created.time,
          budget: created.budget,
          status: created.status as Gig["status"],
          gigType: "public-concert",
          location: null,
        },
        ...prev,
      ]);
      // Reset form
      setGigTitle("");
      setGigDescription("");
      setGigDate("");
      setGigTime("");
      setGigBudget("");
      setGigLocationId("");
      setShowGigForm(false);
      setGigSuccess(true);
      setTimeout(() => setGigSuccess(false), 3000);
    } catch (err) {
      setGigError(err instanceof Error ? err.message : "Failed to create gig");
    } finally {
      setGigBusy(false);
    }
  }

  if (loading) {
    return (
      <HostDashboardShell title="My Gigs" subtitle="Loading...">
        <p className={ui.help}>Loading your gigs...</p>
      </HostDashboardShell>
    );
  }

  return (
    <HostDashboardShell
      title="My Gigs"
      subtitle="Post gigs and review applicants"
    >
      <div className={styles.gigsTab}>
        {/* Create Gig Section */}
        <Section
          title="Post a Gig"
          action={
            !showGigForm && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowGigForm(true)}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Plus size={14} /> New Gig
              </Button>
            )
          }
        >
          {showGigForm ? (
            <form
              onSubmit={handleCreateGig}
              className={[ui.card, ui.cardPad].join(" ")}
            >
              <div className={styles.gigFormGrid}>
                <div className={ui.field}>
                  <label className={ui.label}>Title *</label>
                  <input
                    type="text"
                    placeholder="e.g., Wedding Reception Performance"
                    value={gigTitle}
                    onChange={(e) => setGigTitle(e.target.value)}
                    className={ui.input}
                    required
                  />
                </div>
                <div className={ui.field}>
                  <label className={ui.label}>Description</label>
                  <textarea
                    placeholder="Details about the gig..."
                    value={gigDescription}
                    onChange={(e) => setGigDescription(e.target.value)}
                    className={ui.input}
                    rows={2}
                  />
                </div>
                <div className={styles.formRow}>
                  <div className={ui.field} style={{ flex: 1 }}>
                    <label className={ui.label}>Date *</label>
                    <input
                      type="date"
                      value={gigDate}
                      onChange={(e) => setGigDate(e.target.value)}
                      className={ui.input}
                      required
                    />
                  </div>
                  <div className={ui.field} style={{ flex: 1 }}>
                    <label className={ui.label}>Time</label>
                    <input
                      type="time"
                      value={gigTime}
                      onChange={(e) => setGigTime(e.target.value)}
                      className={ui.input}
                    />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className={ui.field} style={{ flex: 1 }}>
                    <label className={ui.label}>Budget ($)</label>
                    <input
                      type="number"
                      placeholder="0"
                      min={0}
                      value={gigBudget}
                      onChange={(e) =>
                        setGigBudget(
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                      className={ui.input}
                    />
                  </div>
                  <div className={ui.field} style={{ flex: 1 }}>
                    <label className={ui.label}>Venue</label>
                    <select
                      value={gigLocationId}
                      onChange={(e) => setGigLocationId(e.target.value)}
                      className={ui.input}
                    >
                      <option value="">Select a venue...</option>
                      {venues.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                    <p className={ui.help}>
                      {venues.length === 0 && (
                        <>
                          No venues yet.{" "}
                          <Link to="/venues" className={styles.inlineLink}>
                            Add one first
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                {gigError && <p className={ui.error}>{gigError}</p>}
                <div className={styles.formActions}>
                  <Button type="submit" disabled={gigBusy}>
                    {gigBusy ? "Creating..." : "Create Gig"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowGigForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </form>
          ) : (
            <p className={ui.help}>
              {gigSuccess
                ? "✓ Gig created successfully!"
                : "Create a new gig to find musicians for your event."}
            </p>
          )}
        </Section>

        {/* Gigs List */}
        <Section title={`Your Gigs (${gigs.length})`}>
          {gigs.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No gigs posted yet.</p>
              <Button variant="primary" onClick={() => setShowGigForm(true)}>
                Post your first gig
              </Button>
            </div>
          ) : (
            <div className={styles.cardList}>
              {gigs.map((g) => {
                const isExpanded = expandedGigId === g.id;
                return (
                  <div
                    key={g.id}
                    className={[ui.card, styles.gigCard].join(" ")}
                  >
                    <div
                      className={styles.gigCardHeader}
                      onClick={() => setExpandedGigId(isExpanded ? null : g.id)}
                    >
                      <div className={styles.gigCardInfo}>
                        <p className={styles.gigCardTitle}>{g.title}</p>
                        <p className={styles.gigCardMeta}>
                          {g.date}
                          {g.time ? ` · ${g.time}` : ""}
                          {g.location?.city ? ` · ${g.location.city}` : ""}
                        </p>
                      </div>
                      <div className={styles.gigCardActions}>
                        <span className={ui.chip}>
                          {g.status === "open" ? "Open" : g.status}
                        </span>
                        {isExpanded ? (
                          <ChevronUp size={18} />
                        ) : (
                          <ChevronDown size={18} />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className={styles.gigCardBody}>
                        {g.description && (
                          <p className={ui.help}>{g.description}</p>
                        )}
                        {g.budget !== undefined && g.budget > 0 && (
                          <p className={styles.gigCardBudget}>
                            Budget: ${g.budget}
                          </p>
                        )}

                        <div className={styles.gigCardButtonRow}>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/gigs/${g.id}/applicants`)}
                          >
                            Review Applicants
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/gigs/${g.id}/seating`)}
                          >
                            <Settings size={14} />
                            Seating & Tickets
                          </Button>
                          {g.gigType === "public-concert" && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => navigate(`/gigs/${g.id}/tickets`)}
                            >
                              Manage Tickets
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      </div>
    </HostDashboardShell>
  );
}

export default MyGigsPage;
