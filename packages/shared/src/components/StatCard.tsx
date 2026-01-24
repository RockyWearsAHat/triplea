import * as React from "react";
import ui from "@shared/styles/primitives.module.scss";

export function StatCard({
  title,
  value,
  subtitle,
}: {
  title?: React.ReactNode;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <div className={ui.statCard}>
      {title ? <p className={ui.cardTitle}>{title}</p> : null}
      <p className={ui.statNumber}>{value}</p>
      {subtitle ? <p className={ui.statSubtitle}>{subtitle}</p> : null}
    </div>
  );
}

export default StatCard;
