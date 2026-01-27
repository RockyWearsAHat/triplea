import React, { useEffect, useMemo, useState } from "react";
import type { Gig, Location, MusicianProfile } from "@shared";
import { Button, useAuth } from "@shared";
import { useNavigate, Link } from "react-router-dom";
import ui from "@shared/styles/primitives.module.scss";
import { createApiClient } from "../lib/urls";
import { HostDashboardShell } from "../components/HostDashboardShell";
import styles from "./ManagePage.module.scss";
import { Plus, ScanLine, MapPin } from "lucide-react";

interface DiscoveryResult {
  musician: MusicianProfile;
  priceEstimate: number;
  distanceMinutes: number;
}

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

  // State for data
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [venues, setVenues] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [discoveryResults, setDiscoveryResults] = useState<DiscoveryResult[]>(
    [],
  );

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

  if (loading) {
    return (
      <HostDashboardShell title="Dashboard" subtitle="Loading...">
        <p className={ui.help}>Loading your dashboard...</p>
      </HostDashboardShell>
    );
  }

  return (
    <HostDashboardShell
      title="Dashboard"
      subtitle="Your events, venues, and operations"
    >
      <div className={styles.overviewGrid}>
        {/* Quick Stats */}
        <div className={styles.statsRow}>
          <Link to="/my-gigs" className={styles.statCard}>
            <span className={styles.statNumber}>{gigs.length}</span>
            <span className={styles.statLabel}>Active Gigs</span>
          </Link>
          <Link to="/venues" className={styles.statCard}>
            <span className={styles.statNumber}>{venues.length}</span>
            <span className={styles.statLabel}>Venues</span>
          </Link>
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
              onClick={() => navigate("/venues")}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <MapPin size={14} /> Add Venue
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate("/scan-tickets")}
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
              <Link to="/my-gigs" className={styles.viewAllLink}>
                View all →
              </Link>
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
    </HostDashboardShell>
  );
}
