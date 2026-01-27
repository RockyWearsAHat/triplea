import { Button } from "@shared";
import styles from "./DashboardPage.module.scss";
import StatusCard from "@shared/components/StatusCard";

/* ══════════════════════════════════════════════════════════════════════════
   Triple A Musician - Dashboard
   
   Vision from owner: Like "Uber Driver" app
   - Work dashboard showing incoming requests, upcoming gigs
   - Clear status: earnings, rating, pending requests
   - Quick actions to respond to requests
   - Focus on "today/this week" 
   ══════════════════════════════════════════════════════════════════════════ */

export function DashboardPage() {
  return (
    <div className={styles.page}>
      {/* Today's Focus - Driver app style */}
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>Good afternoon</h1>
        <p className={styles.headerSubtitle}>Here's your week at a glance</p>
      </header>

      {/* Stats Row - Key metrics front and center */}
      <section className={styles.statsSection}>
        <div className={styles.statsRow}>
          <StatusCard
            title="Earnings"
            subtitle="This week"
            metric="$450"
            status="active"
          />
          <StatusCard
            title="Rating"
            subtitle="Avg. performance"
            metric="4.8★"
            status="idle"
          />
          <StatusCard
            title="Requests"
            subtitle="Pending"
            metric={3}
            status="busy"
          />
        </div>
      </section>

      {/* Main Content Grid */}
      <div className={styles.grid}>
        <main className={styles.main}>
          {/* Incoming Requests - Most urgent */}
          <section className={styles.contentSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Incoming requests</h2>
              <span className={styles.badge}>3 new</span>
            </div>
            <p className={styles.sectionHint}>
              Respond to requests quickly to keep work flowing.
            </p>
            <div className={styles.requestList}>
              <div className={styles.requestCard}>
                <div className={styles.requestInfo}>
                  <p className={styles.requestTitle}>Wedding Reception</p>
                  <p className={styles.requestMeta}>
                    Feb 14 · Downtown Ballroom · $350
                  </p>
                </div>
                <div className={styles.requestActions}>
                  <Button size="sm">Accept</Button>
                  <Button size="sm" variant="ghost">
                    Decline
                  </Button>
                </div>
              </div>
              <div className={styles.requestCard}>
                <div className={styles.requestInfo}>
                  <p className={styles.requestTitle}>Corporate Event</p>
                  <p className={styles.requestMeta}>
                    Feb 20 · Harbor Hall · $500
                  </p>
                </div>
                <div className={styles.requestActions}>
                  <Button size="sm">Accept</Button>
                  <Button size="sm" variant="ghost">
                    Decline
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* Upcoming Gigs */}
          <section className={styles.contentSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Upcoming gigs</h2>
            </div>
            <p className={styles.sectionHint}>
              Your next confirmed performances.
            </p>
            <div className={styles.gigList}>
              <div className={styles.gigCard}>
                <div className={styles.gigDate}>
                  <span className={styles.gigDay}>28</span>
                  <span className={styles.gigMonth}>Jan</span>
                </div>
                <div className={styles.gigInfo}>
                  <p className={styles.gigTitle}>Jazz Night</p>
                  <p className={styles.gigMeta}>7:00 PM · Blue Note Lounge</p>
                </div>
                <span className={styles.gigStatus}>Confirmed</span>
              </div>
              <div className={styles.gigCard}>
                <div className={styles.gigDate}>
                  <span className={styles.gigDay}>02</span>
                  <span className={styles.gigMonth}>Feb</span>
                </div>
                <div className={styles.gigInfo}>
                  <p className={styles.gigTitle}>Private Party</p>
                  <p className={styles.gigMeta}>8:30 PM · Skyline Rooftop</p>
                </div>
                <span className={styles.gigStatus}>Confirmed</span>
              </div>
            </div>
          </section>
        </main>

        {/* Sidebar - Quick actions & profile */}
        <aside className={styles.sidebar}>
          <section>
            <h3 className={styles.sidebarTitle}>Quick actions</h3>
            <div className={styles.quickActions}>
              <Button style={{ width: "100%" }}>Edit profile</Button>
              <Button variant="secondary" style={{ width: "100%" }}>
                Update availability
              </Button>
              <Button variant="ghost" style={{ width: "100%" }}>
                View earnings
              </Button>
            </div>
          </section>

          <section className={styles.sidebarSection}>
            <h3 className={styles.sidebarTitle}>Your perks</h3>
            <p className={styles.sectionHint}>
              Build reputation to unlock rewards.
            </p>
            <div className={styles.perksList}>
              <div className={styles.perkItem}>
                <span className={styles.perkIcon}>🎸</span>
                <span className={styles.perkLabel}>Free rental credit</span>
              </div>
              <div className={styles.perkItem}>
                <span className={styles.perkIcon}>🎨</span>
                <span className={styles.perkLabel}>Embroidery discount</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default DashboardPage;
