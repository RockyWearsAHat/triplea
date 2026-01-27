import { spacing } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import { HostDashboardShell } from "../components/HostDashboardShell";
import styles from "./StaffPage.module.scss";

export function StaffPage() {
  return (
    <HostDashboardShell title="Staff" subtitle="Manage your event team">
      <div className={styles.staffTab}>
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Event Staff</h3>
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
        </section>
      </div>
    </HostDashboardShell>
  );
}

export default StaffPage;
