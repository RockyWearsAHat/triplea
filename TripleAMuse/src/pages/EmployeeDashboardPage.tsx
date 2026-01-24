import { AppShell, Button, spacing } from "@shared";
import ui from "@shared/styles/primitives.module.scss";

export function EmployeeDashboardPage() {
  return (
    <AppShell
      title="Employee dashboard"
      subtitle="Today's gear runs, pickups, and on-site jobs."
    >
      <div
        style={{ display: "flex", flexDirection: "column", gap: spacing.md }}
      >
        <section className={ui.section}>
          <h2 className={ui.sectionTitle}>Your tasks today</h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing.sm,
            }}
          >
            <div className={[ui.card, ui.cardPad].join(" ")}>
              <h3 style={{ fontWeight: 600 }}>Deliver backline to City Club</h3>
              <p style={{ marginTop: spacing.xs }} className={ui.help}>
                Pickup 17:00 · Load-in 17:30 · Contact: Jamie (musician).
              </p>
              <div
                style={{
                  display: "flex",
                  gap: spacing.sm,
                  marginTop: spacing.sm,
                }}
              >
                <Button variant="secondary">Mark in progress</Button>
                <Button variant="ghost">View route</Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
