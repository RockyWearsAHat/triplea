import { Button, useAuth } from "@shared";
import styles from "./DashboardPage.module.scss";
import { useNavigate } from "react-router-dom";

/* ══════════════════════════════════════════════════════════════════════════
   Triple A Musician - Dashboard
   
   Apple/Uber Driver inspired work dashboard:
   - Time-aware greeting
   - Key metrics at a glance (earnings, rating, pending)
   - Incoming requests requiring action
   - Upcoming schedule with date visualization
   - Quick action sidebar (iOS Settings style)
   ══════════════════════════════════════════════════════════════════════════ */

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(dateStr: string): { day: string; month: string } {
  const d = new Date(dateStr);
  return {
    day: d.getDate().toString().padStart(2, "0"),
    month: d.toLocaleString("en", { month: "short" }),
  };
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div className={styles.page}>
      {/* Greeting */}
      <header className={styles.pageHeader}>
        <h1 className={styles.greeting}>
          {getGreeting()}, {firstName}
        </h1>
        <p className={styles.greetingSub}>Here's your week at a glance</p>
      </header>

      {/* Metrics Row */}
      <section className={styles.metricsRow}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Earnings</span>
          <span className={styles.metricValue}>$450</span>
          <span className={styles.metricSub}>This week</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Rating</span>
          <span className={styles.metricValue}>
            4.8<span className={styles.metricUnit}>★</span>
          </span>
          <span className={styles.metricSub}>Performance avg.</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Requests</span>
          <span
            className={[styles.metricValue, styles.metricHighlight].join(" ")}
          >
            3
          </span>
          <span className={styles.metricSub}>Pending response</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Gigs</span>
          <span className={styles.metricValue}>2</span>
          <span className={styles.metricSub}>Upcoming</span>
        </div>
      </section>

      {/* Main Content Grid */}
      <div className={styles.dashGrid}>
        <main className={styles.mainCol}>
          {/* Incoming Requests */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Incoming requests</h2>
                <p className={styles.sectionDesc}>
                  Respond quickly to keep work flowing
                </p>
              </div>
              <span className={styles.countBadge}>3 new</span>
            </div>

            <div className={styles.requestList}>
              {[
                {
                  title: "Wedding Reception",
                  date: "Feb 14",
                  venue: "Downtown Ballroom",
                  pay: 350,
                  type: "Wedding",
                },
                {
                  title: "Corporate Event",
                  date: "Feb 20",
                  venue: "Harbor Hall",
                  pay: 500,
                  type: "Corporate",
                },
                {
                  title: "Jazz Brunch",
                  date: "Feb 22",
                  venue: "Garden Terrace",
                  pay: 275,
                  type: "Brunch",
                },
              ].map((req, i) => (
                <article key={i} className={styles.requestCard}>
                  <div className={styles.requestMain}>
                    <div className={styles.requestHeader}>
                      <h3 className={styles.requestTitle}>{req.title}</h3>
                      <span className={styles.requestPay}>${req.pay}</span>
                    </div>
                    <div className={styles.requestMeta}>
                      <span className={styles.metaItem}>📅 {req.date}</span>
                      <span className={styles.metaItem}>📍 {req.venue}</span>
                      <span className={styles.requestType}>{req.type}</span>
                    </div>
                  </div>
                  <div className={styles.requestActions}>
                    <Button size="sm">Accept</Button>
                    <Button size="sm" variant="ghost">
                      Decline
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Upcoming Schedule */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Upcoming schedule</h2>
                <p className={styles.sectionDesc}>
                  Your next confirmed performances
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/bookings")}
              >
                View all
              </Button>
            </div>

            <div className={styles.scheduleList}>
              {[
                {
                  title: "Jazz Night",
                  date: "2026-01-28",
                  time: "7:00 PM",
                  venue: "Blue Note Lounge",
                  status: "confirmed",
                },
                {
                  title: "Private Party",
                  date: "2026-02-02",
                  time: "8:30 PM",
                  venue: "Skyline Rooftop",
                  status: "confirmed",
                },
                {
                  title: "Charity Gala",
                  date: "2026-02-10",
                  time: "6:00 PM",
                  venue: "Grand Ballroom",
                  status: "pending",
                },
              ].map((gig, i) => {
                const d = formatDate(gig.date);
                return (
                  <article key={i} className={styles.scheduleCard}>
                    <div className={styles.dateBlock}>
                      <span className={styles.dateDay}>{d.day}</span>
                      <span className={styles.dateMonth}>{d.month}</span>
                    </div>
                    <div className={styles.scheduleInfo}>
                      <h3 className={styles.scheduleTitle}>{gig.title}</h3>
                      <p className={styles.scheduleMeta}>
                        {gig.time} · {gig.venue}
                      </p>
                    </div>
                    <span
                      className={`${styles.statusPill} ${gig.status === "confirmed" ? styles.statusConfirmed : styles.statusPending}`}
                    >
                      {gig.status === "confirmed" ? "Confirmed" : "Pending"}
                    </span>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Browse Open Gigs CTA */}
          <section className={styles.ctaCard}>
            <div className={styles.ctaContent}>
              <h3 className={styles.ctaTitle}>Looking for more work?</h3>
              <p className={styles.ctaDesc}>
                Browse open gigs from hosts in your area and apply directly.
              </p>
            </div>
            <Button variant="secondary" onClick={() => navigate("/gigs")}>
              Browse gigs
            </Button>
          </section>
        </main>

        {/* Sidebar */}
        <aside className={styles.sideCol}>
          {/* Quick Actions */}
          <div className={styles.sideCard}>
            <h3 className={styles.sideTitle}>Quick actions</h3>
            <nav className={styles.actionNav}>
              <button
                className={styles.actionBtn}
                onClick={() => navigate("/profile")}
              >
                <span className={styles.actionIcon}>👤</span>
                <span>Edit profile</span>
                <span className={styles.actionChevron}>›</span>
              </button>
              <button
                className={styles.actionBtn}
                onClick={() => navigate("/rentals")}
              >
                <span className={styles.actionIcon}>🎸</span>
                <span>Rent gear</span>
                <span className={styles.actionChevron}>›</span>
              </button>
              <button
                className={styles.actionBtn}
                onClick={() => navigate("/messages")}
              >
                <span className={styles.actionIcon}>💬</span>
                <span>Messages</span>
                <span className={styles.actionChevron}>›</span>
              </button>
              <button
                className={styles.actionBtn}
                onClick={() => navigate("/bookings")}
              >
                <span className={styles.actionIcon}>📋</span>
                <span>All bookings</span>
                <span className={styles.actionChevron}>›</span>
              </button>
            </nav>
          </div>

          {/* Perks */}
          <div className={styles.sideCard}>
            <h3 className={styles.sideTitle}>Your perks</h3>
            <p className={styles.sideDesc}>
              Build reputation to unlock rewards
            </p>
            <div className={styles.perksList}>
              <div className={styles.perkItem}>
                <span className={styles.perkIcon}>🎸</span>
                <div className={styles.perkContent}>
                  <span className={styles.perkName}>Free rental credit</span>
                  <span className={styles.perkDetail}>
                    1 day included monthly
                  </span>
                </div>
              </div>
              <div className={styles.perkItem}>
                <span className={styles.perkIcon}>🎨</span>
                <div className={styles.perkContent}>
                  <span className={styles.perkName}>Embroidery discount</span>
                  <span className={styles.perkDetail}>
                    20% off custom branding
                  </span>
                </div>
              </div>
              <div className={styles.perkItem}>
                <span className={styles.perkIcon}>🎤</span>
                <div className={styles.perkContent}>
                  <span className={styles.perkName}>Priority bookings</span>
                  <span className={styles.perkDetail}>
                    4.5+ rating required
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/perks")}
              style={{ marginTop: 8, width: "100%" }}
            >
              View all perks →
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default DashboardPage;
