import { AppShell, spacing, Button } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import styles from "./DashboardPage.module.scss";
import StatusCard from "@shared/components/StatusCard";

export function DashboardPage() {
  return (
    <AppShell title="Your Week at a Glance" subtitle="">
      <div
        className={ui.stack}
        style={{ "--stack-gap": `${spacing.lg}px` } as React.CSSProperties}
      >
        <section>
          <h2 className={ui.sectionTitleLarge}>Your Week at a Glance</h2>
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

        <div className={styles.grid}>
          <main className={styles.main}>
            <section className={styles.contentSection}>
              <h3 className={ui.sectionTitle}>Incoming requests</h3>
              <p className={ui.help}>
                Respond to requests quickly to keep work flowing.
              </p>
            </section>

            <section className={styles.contentSection}>
              <h3 className={ui.sectionTitle}>Upcoming gigs</h3>
              <p className={ui.help}>Your next confirmed gigs and details.</p>
            </section>
          </main>

          <aside className={styles.sidebar}>
            <section>
              <h3 className={ui.sectionTitle}>Quick actions</h3>
              <div className={styles.quickActions}>
                <Button style={{ width: "100%" }}>Edit profile</Button>
                <Button variant="secondary" style={{ width: "100%" }}>
                  Update availability
                </Button>
                <Button variant="ghost" style={{ width: "100%" }}>
                  Request rental
                </Button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

export default DashboardPage;
