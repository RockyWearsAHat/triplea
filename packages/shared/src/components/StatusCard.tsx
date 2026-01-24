import React from "react";
import styles from "./StatusCard.module.scss";
import ui from "../styles/primitives.module.scss";

interface StatusCardProps {
  title: string;
  subtitle?: string;
  metric?: string | number;
  status?: "active" | "idle" | "busy";
  actions?: React.ReactNode;
}

export function StatusCard({
  title,
  subtitle,
  metric,
  status = "idle",
  actions,
}: StatusCardProps) {
  return (
    <div className={styles.statusCard}>
      <div className={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className={styles.indicator} data-status={status} aria-hidden />
          <div>
            <p className={ui.cardTitle} style={{ margin: 0 }}>
              {title}
            </p>
            {subtitle ? (
              <p className={ui.help} style={{ margin: 0 }}>
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? <div>{actions}</div> : null}
      </div>

      {metric !== undefined ? (
        <div className={styles.metric} style={{ marginTop: 8 }}>
          {metric}
        </div>
      ) : null}
    </div>
  );
}

export default StatusCard;
