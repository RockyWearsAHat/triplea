import { AppShell, spacing } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import styles from "./DashboardPage.module.scss";
import StatusCard from "@shared/components/StatusCard";

export function DashboardPage() {
  return (
    <AppShell title="Dashboard" subtitle="Your week at a glance">
      <div
        className={ui.stack}
        style={{ "--stack-gap": `${spacing.md}px` } as React.CSSProperties}
      >
        <div className={styles.header}>
          <div>
            <h2 className={ui.sectionTitle}>Your week</h2>
            <p className={ui.help}>Respond to requests and manage bookings.</p>
          </div>
        </div>

        <div className={styles.stats}>
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

        <div className={styles.grid}>
          <div>
            <section className={ui.section}>
              <h3 className={ui.sectionTitle}>Incoming requests</h3>
              <p className={ui.help}>
                Respond to requests quickly to keep work flowing.
              </p>
            </section>

            <section className={ui.section}>
              <h3 className={ui.sectionTitle}>Bookings</h3>
              <p className={ui.help}>
                Upcoming and recent bookings appear here.
              </p>
            </section>
          </div>

          <aside>
            <section className={ui.section}>
              <h3 className={ui.sectionTitle}>Profile</h3>
              <p className={ui.help}>
                Edit your profile, rates, and direct request settings.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
export default DashboardPage;
