import React, { useEffect, useMemo, useState } from "react";
import type { Gig, Location, MusicianProfile } from "@shared";
import { AppShell, Button, spacing, useAuth } from "@shared";
import { useNavigate, useSearchParams } from "react-router-dom";
import ui from "@shared/styles/primitives.module.scss";
import { createApiClient, getAssetUrl } from "../lib/urls";
import styles from "./ManagePage.module.scss";
import {
  CalendarDays,
  ScanLine,
  Ticket,
  MapPin,
  Users,
  Plus,
} from "lucide-react";

interface DiscoveryResult {
  musician: MusicianProfile;
  priceEstimate: number;
  distanceMinutes: number;
}

type TabId = "overview" | "gigs" | "venues" | "staff" | "scanner";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <CalendarDays size={16} /> },
  { id: "gigs", label: "My Gigs", icon: <Ticket size={16} /> },
  { id: "venues", label: "Venues", icon: <MapPin size={16} /> },
  { id: "staff", label: "Staff", icon: <Users size={16} /> },
  { id: "scanner", label: "Ticket Scanner", icon: <ScanLine size={16} /> },
];

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

export default function ManagePage() {
  const api = useMemo(() => createApiClient(), []);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get("tab") as TabId | null;
  const activeTab: TabId =
    tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : "overview";

  const setActiveTab = (tab: TabId) => {
    setSearchParams({ tab });
  };

  // State for data
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [venues, setVenues] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [discoveryResults, setDiscoveryResults] = useState<DiscoveryResult[]>(
    [],
  );

  // Venue creation
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [venueCity, setVenueCity] = useState("");
  const [venueBusy, setVenueBusy] = useState(false);
  const [venueError, setVenueError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      api.listMyGigs().catch(() => []),
      api.listMyStageLocations().catch(() => []),
      api.musicDiscovery({}).catch(() => []),
    ])
      .then(([gigsData, venuesData, discovery]) => {
        setGigs(gigsData);
        setVenues(venuesData);
        setDiscoveryResults(discovery);
      })
      .finally(() => setLoading(false));
  }, [api, user]);

  async function handleCreateVenue(e: React.FormEvent) {
    e.preventDefault();
    setVenueError(null);
    setVenueBusy(true);
    try {
      const created = await api.createStageLocation({
        name: venueName,
        address: venueAddress,
        city: venueCity,
      });
      setVenues((prev) => [created, ...prev]);
      setVenueName("");
      setVenueAddress("");
      setVenueCity("");
    } catch (err) {
      setVenueError(
        err instanceof Error ? err.message : "Failed to create venue",
      );
    } finally {
      setVenueBusy(false);
    }
  }

  function renderOverview() {
    return (
      <div className={styles.overviewGrid}>
        {/* Quick Stats */}
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>{gigs.length}</span>
            <span className={styles.statLabel}>Active Gigs</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>{venues.length}</span>
            <span className={styles.statLabel}>Venues</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>{discoveryResults.length}</span>
            <span className={styles.statLabel}>Musicians Found</span>
          </div>
        </div>

        {/* Quick Actions */}
        <Section title="Quick Actions">
          <div className={styles.quickActions}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate("/my-gigs")}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={14} /> Post a Gig
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setActiveTab("venues")}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <MapPin size={14} /> Add Venue
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setActiveTab("scanner")}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <ScanLine size={14} /> Scan Tickets
            </Button>
          </div>
        </Section>

        {/* Upcoming Gigs Preview */}
        {gigs.length > 0 && (
          <Section
            title="Upcoming Gigs"
            action={
              <button
                className={styles.viewAllLink}
                onClick={() => setActiveTab("gigs")}
              >
                View all →
              </button>
            }
          >
            <div className={styles.cardList}>
              {gigs.slice(0, 3).map((g) => (
                <div key={g.id} className={styles.miniCard}>
                  <div>
                    <p className={styles.miniCardTitle}>{g.title}</p>
                    <p className={styles.miniCardMeta}>
                      {g.date}
                      {g.location?.city ? ` · ${g.location.city}` : ""}
                    </p>
                  </div>
                  <span className={ui.chip}>
                    {g.status === "open" ? "Open" : g.status}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Available Musicians Preview */}
        {discoveryResults.length > 0 && (
          <Section title="Available Musicians">
            <div className={styles.cardList}>
              {discoveryResults.slice(0, 4).map((r) => (
                <div
                  key={r.musician.id}
                  className={styles.miniCard}
                  onClick={() =>
                    navigate(`/musicians/${r.musician.userId}?request=true`)
                  }
                  style={{ cursor: "pointer" }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <div className={styles.avatarPlaceholder}>🎵</div>
                    <div>
                      <p className={styles.miniCardMeta}>
                        ${r.priceEstimate}/hr estimate
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    );
  }

  function renderGigs() {
    if (gigs.length === 0) {
      return (
        <div className={styles.emptyState}>
          <p>No gigs posted yet.</p>
          <Button variant="primary" onClick={() => navigate("/my-gigs")}>
            Post your first gig
          </Button>
        </div>
      );
    }
    return (
      <div className={styles.cardList}>
        {gigs.map((g) => (
          <div key={g.id} className={[ui.card, ui.cardPad].join(" ")}>
            <div className={styles.cardRow}>
              <div>
                <p className={ui.cardTitle}>{g.title}</p>
                <p className={ui.cardText}>
                  {g.date}
                  {g.location?.city ? ` · ${g.location.city}` : ""}
                </p>
                {g.budget !== undefined && (
                  <p className={ui.help}>Budget: ${g.budget}</p>
                )}
              </div>
              <div className={styles.cardActions}>
                <span className={ui.chip}>
                  {g.status === "open" ? "Open" : g.status}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/gigs/${g.id}/applicants`)}
                >
                  Applicants
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderVenues() {
    return (
      <div className={styles.venuesTab}>
        {/* Add Venue Form */}
        <Section title="Add a Venue">
          <form
            onSubmit={handleCreateVenue}
            className={[ui.card, ui.cardPad].join(" ")}
          >
            <div className={styles.formRow}>
              <input
                placeholder="Venue name"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                className={ui.input}
                required
              />
              <input
                placeholder="Address"
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
                className={ui.input}
              />
              <input
                placeholder="City"
                value={venueCity}
                onChange={(e) => setVenueCity(e.target.value)}
                className={ui.input}
                required
              />
              <Button type="submit" disabled={venueBusy}>
                {venueBusy ? "Adding..." : "Add Venue"}
              </Button>
            </div>
            {venueError && <p className={ui.error}>{venueError}</p>}
          </form>
        </Section>

        {/* Venue List */}
        <Section title="Your Venues">
          {venues.length === 0 ? (
            <p className={ui.help}>No venues added yet.</p>
          ) : (
            <div className={styles.cardList}>
              {venues.map((v) => (
                <div key={v.id} className={[ui.card, ui.cardPad].join(" ")}>
                  <div className={styles.cardRow}>
                    <div
                      style={{ display: "flex", gap: 12, alignItems: "center" }}
                    >
                      {v.imageUrl ? (
                        <img
                          src={getAssetUrl(v.imageUrl)}
                          alt=""
                          className={styles.venueThumb}
                        />
                      ) : (
                        <div className={styles.venueThumbPlaceholder}>🏛️</div>
                      )}
                      <div>
                        <p className={ui.cardTitle}>{v.name}</p>
                        <p className={ui.cardText}>
                          {v.address && `${v.address}, `}
                          {v.city}
                        </p>
                        {v.seatCapacity && (
                          <p className={ui.help}>Capacity: {v.seatCapacity}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    );
  }

  function renderStaff() {
    return (
      <div className={styles.staffTab}>
        <Section title="Event Staff">
          <p className={ui.help} style={{ marginBottom: spacing.sm }}>
            Assign staff members who can scan tickets at your events.
          </p>

          <div className={[ui.card, ui.cardPad].join(" ")}>
            <p className={styles.comingSoon}>Staff management coming soon:</p>
            <ul className={styles.featureList}>
              <li>Add staff by email address</li>
              <li>Assign staff to specific events</li>
              <li>Grant scanner access for ticket validation</li>
              <li>Track check-ins per staff member</li>
            </ul>
          </div>
        </Section>
      </div>
    );
  }

  function renderScanner() {
    return (
      <div className={styles.scannerTab}>
        <Section title="Ticket Scanner">
          <p className={ui.help} style={{ marginBottom: spacing.sm }}>
            Use the scanner to validate tickets at your events.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate("/scan-tickets")}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <ScanLine size={14} /> Open Full Scanner
          </Button>
        </Section>
      </div>
    );
  }

  if (loading) {
    return (
      <AppShell title="Manage" subtitle="Loading...">
        <p className={ui.help}>Loading your dashboard...</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Manage" subtitle="Your events, venues, and operations">
      <div className={styles.container}>
        {/* Tab Navigation */}
        <nav className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Tab Content */}
        <div className={styles.content}>
          {activeTab === "overview" && renderOverview()}
          {activeTab === "gigs" && renderGigs()}
          {activeTab === "venues" && renderVenues()}
          {activeTab === "staff" && renderStaff()}
          {activeTab === "scanner" && renderScanner()}
        </div>
      </div>
    </AppShell>
  );
}
