import React, { useEffect, useMemo, useState } from "react";
import type { GigWithStats, Location, MusicianProfile } from "@shared";
import { Button, useAuth } from "@shared";
import { useNavigate, Link } from "react-router-dom";
import ui from "@shared/styles/primitives.module.scss";
import { createApiClient, getAssetUrl } from "../lib/urls";
import { HostDashboardShell } from "../components/HostDashboardShell";
import styles from "./ManagePage.module.scss";
import {
  Plus,
  ScanLine,
  MapPin,
  Users,
  Ticket,
  Eye,
  EyeOff,
  DollarSign,
  Calendar,
  Clock,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface DiscoveryResult {
  musician: MusicianProfile;
  priceEstimate: number;
  distanceMinutes: number;
}

function Section({
  title,
  children,
  action,
  icon,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleRow}>
          {icon && <span className={styles.sectionIcon}>{icon}</span>}
          <h3 className={styles.sectionTitle}>{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function GigTypeBadge({ gigType }: { gigType?: string }) {
  const isPublic = gigType === "public-concert";
  return (
    <span
      className={`${styles.badge} ${isPublic ? styles.badgePublic : styles.badgePrivate}`}
    >
      {isPublic ? <Eye size={10} /> : <EyeOff size={10} />}
      {isPublic ? "Public" : "Private"}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<
    string,
    { className: string; icon: React.ReactNode; label: string }
  > = {
    open: {
      className: styles.badgeOpen,
      icon: <Clock size={10} />,
      label: "Open",
    },
    filled: {
      className: styles.badgeFilled,
      icon: <CheckCircle2 size={10} />,
      label: "Filled",
    },
    cancelled: {
      className: styles.badgeCancelled,
      icon: <AlertCircle size={10} />,
      label: "Cancelled",
    },
  };
  const config = statusConfig[status] || statusConfig.open;
  return (
    <span className={`${styles.badge} ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

export default function ManagePage() {
  const api = useMemo(() => createApiClient(), []);
  const navigate = useNavigate();
  const { user } = useAuth();

  // State for data
  const [gigs, setGigs] = useState<GigWithStats[]>([]);
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

  // Separate gigs into pending (open) and scheduled (filled)
  const pendingGigs = useMemo(
    () => gigs.filter((g) => g.status === "open"),
    [gigs],
  );
  const scheduledGigs = useMemo(
    () => gigs.filter((g) => g.status === "filled"),
    [gigs],
  );
  const publicConcerts = useMemo(
    () => gigs.filter((g) => g.gigType === "public-concert"),
    [gigs],
  );

  // Calculate aggregate stats
  const totalTicketsSold = useMemo(
    () => gigs.reduce((sum, g) => sum + (g.ticketsSold || 0), 0),
    [gigs],
  );
  const totalRevenue = useMemo(
    () => gigs.reduce((sum, g) => sum + (g.ticketRevenue || 0), 0),
    [gigs],
  );
  const totalApplicants = useMemo(
    () => gigs.reduce((sum, g) => sum + (g.applicantCount || 0), 0),
    [gigs],
  );

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
      <div className={styles.dashboard}>
        {/* Stats Overview */}
        <div className={styles.statsGrid}>
          <Link
            to="/my-gigs"
            className={`${styles.statCard} ${styles.statCardLink}`}
          >
            <div className={styles.statIcon}>
              <Calendar size={20} />
            </div>
            <div className={styles.statContent}>
              <span className={styles.statNumber}>{gigs.length}</span>
              <span className={styles.statLabel}>Total Events</span>
            </div>
          </Link>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <Clock size={20} />
            </div>
            <div className={styles.statContent}>
              <span className={styles.statNumber}>{pendingGigs.length}</span>
              <span className={styles.statLabel}>Pending</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <CheckCircle2 size={20} />
            </div>
            <div className={styles.statContent}>
              <span className={styles.statNumber}>{scheduledGigs.length}</span>
              <span className={styles.statLabel}>Scheduled</span>
            </div>
          </div>

          <Link
            to="/venues"
            className={`${styles.statCard} ${styles.statCardLink}`}
          >
            <div className={styles.statIcon}>
              <MapPin size={20} />
            </div>
            <div className={styles.statContent}>
              <span className={styles.statNumber}>{venues.length}</span>
              <span className={styles.statLabel}>Venues</span>
            </div>
          </Link>

          {publicConcerts.length > 0 && (
            <>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <Ticket size={20} />
                </div>
                <div className={styles.statContent}>
                  <span className={styles.statNumber}>{totalTicketsSold}</span>
                  <span className={styles.statLabel}>Tickets Sold</span>
                </div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <DollarSign size={20} />
                </div>
                <div className={styles.statContent}>
                  <span className={styles.statNumber}>
                    ${totalRevenue.toLocaleString()}
                  </span>
                  <span className={styles.statLabel}>Revenue</span>
                </div>
              </div>
            </>
          )}

          {totalApplicants > 0 && (
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <Users size={20} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statNumber}>{totalApplicants}</span>
                <span className={styles.statLabel}>Applicants</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <Section title="Quick Actions" icon={<TrendingUp size={16} />}>
          <div className={styles.quickActions}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate("/my-gigs")}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={14} /> Post Event
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
              onClick={() => navigate("/staff")}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Users size={14} /> Manage Staff
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

        {/* Venues Preview */}
        <Section
          title={`Venues (${venues.length})`}
          icon={<MapPin size={16} />}
          action={
            venues.length > 4 ? (
              <Link to="/venues" className={styles.viewAllLink}>
                View all →
              </Link>
            ) : null
          }
        >
          {venues.length === 0 ? (
            <div className={styles.emptyState}>
              <MapPin size={24} />
              <p>No venues yet</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate("/venues")}
              >
                <Plus size={14} /> Add Venue
              </Button>
            </div>
          ) : (
            <div className={styles.venuesGrid}>
              {venues.slice(0, 4).map((v) => (
                <div
                  key={v.id}
                  className={styles.venueCard}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/venues/${v.id}/seating`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/venues/${v.id}/seating`);
                    }
                  }}
                >
                  {v.imageUrl ? (
                    <img
                      src={getAssetUrl(v.imageUrl)}
                      alt=""
                      className={styles.venueThumb}
                    />
                  ) : (
                    <div className={styles.venueThumbPlaceholder} />
                  )}
                  <div className={styles.venueInfo}>
                    <p className={styles.venueName}>{v.name}</p>
                    <p className={styles.venueMeta}>
                      {v.city}
                      {v.seatCapacity ? ` · ${v.seatCapacity} seats` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Two-column layout for Pending and Scheduled */}
        <div className={styles.eventsColumns}>
          {/* Pending Events */}
          <Section
            title={`Pending Events (${pendingGigs.length})`}
            icon={<Clock size={16} />}
            action={
              pendingGigs.length > 3 ? (
                <Link to="/my-gigs?status=open" className={styles.viewAllLink}>
                  View all →
                </Link>
              ) : null
            }
          >
            {pendingGigs.length === 0 ? (
              <div className={styles.emptyState}>
                <AlertCircle size={24} />
                <p>No pending events</p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate("/my-gigs")}
                >
                  <Plus size={14} /> Create Event
                </Button>
              </div>
            ) : (
              <div className={styles.eventList}>
                {pendingGigs.slice(0, 4).map((g) => (
                  <div
                    key={g.id}
                    className={styles.eventCard}
                    onClick={() => navigate(`/my-gigs/${g.id}`)}
                  >
                    <div className={styles.eventCardHeader}>
                      <p className={styles.eventCardTitle}>{g.title}</p>
                      <div className={styles.eventCardBadges}>
                        <GigTypeBadge gigType={g.gigType} />
                        <StatusBadge status={g.status} />
                      </div>
                    </div>
                    <div className={styles.eventCardMeta}>
                      <span>
                        <Calendar size={12} /> {g.date}
                      </span>
                      {(g.applicantCount ?? 0) > 0 && (
                        <span className={styles.applicantCount}>
                          <Users size={12} /> {g.applicantCount} applicant
                          {g.applicantCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    {g.gigType === "public-concert" && g.openForTickets && (
                      <div className={styles.eventCardStats}>
                        <span>
                          <Ticket size={12} /> {g.ticketsSold || 0} sold
                        </span>
                        <span>
                          <DollarSign size={12} /> $
                          {(g.ticketRevenue || 0).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Scheduled Events */}
          <Section
            title={`Scheduled Events (${scheduledGigs.length})`}
            icon={<CheckCircle2 size={16} />}
            action={
              scheduledGigs.length > 3 ? (
                <Link
                  to="/my-gigs?status=filled"
                  className={styles.viewAllLink}
                >
                  View all →
                </Link>
              ) : null
            }
          >
            {scheduledGigs.length === 0 ? (
              <div className={styles.emptyState}>
                <CheckCircle2 size={24} />
                <p>No scheduled events yet</p>
                <span className={styles.emptyStateHint}>
                  Accept an applicant to schedule an event
                </span>
              </div>
            ) : (
              <div className={styles.eventList}>
                {scheduledGigs.slice(0, 4).map((g) => (
                  <div
                    key={g.id}
                    className={styles.eventCard}
                    onClick={() => navigate(`/my-gigs/${g.id}`)}
                  >
                    <div className={styles.eventCardHeader}>
                      <p className={styles.eventCardTitle}>{g.title}</p>
                      <div className={styles.eventCardBadges}>
                        <GigTypeBadge gigType={g.gigType} />
                        <StatusBadge status={g.status} />
                      </div>
                    </div>
                    <div className={styles.eventCardMeta}>
                      <span>
                        <Calendar size={12} /> {g.date}
                      </span>
                      {g.time && (
                        <span>
                          <Clock size={12} /> {g.time}
                        </span>
                      )}
                    </div>
                    {g.gigType === "public-concert" && g.openForTickets && (
                      <div className={styles.eventCardStats}>
                        <span>
                          <Ticket size={12} /> {g.ticketsSold || 0} sold
                        </span>
                        <span>
                          <DollarSign size={12} /> $
                          {(g.ticketRevenue || 0).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Available Musicians Preview */}
        {discoveryResults.length > 0 && (
          <Section title="Available Musicians" icon={<Users size={16} />}>
            <div className={styles.musicianGrid}>
              {discoveryResults.slice(0, 6).map((r) => (
                <div
                  key={r.musician.id}
                  className={styles.musicianCard}
                  onClick={() =>
                    navigate(`/musicians/${r.musician.userId}?request=true`)
                  }
                >
                  <div className={styles.avatarPlaceholder} aria-hidden="true">
                    <Users size={16} />
                  </div>
                  <div className={styles.musicianInfo}>
                    <p className={styles.musicianName}>
                      {r.musician.instruments.slice(0, 2).join(", ") ||
                        "Musician"}
                    </p>
                    <p className={styles.musicianMeta}>
                      ${r.priceEstimate}/hr
                      {r.musician.genres?.length > 0 &&
                        ` · ${r.musician.genres.slice(0, 2).join(", ")}`}
                    </p>
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
