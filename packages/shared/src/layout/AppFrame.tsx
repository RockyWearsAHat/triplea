import type { ReactNode } from "react";
import styles from "./AppFrame.module.scss";

export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <div className={styles.root}>
      <div className={styles.container}>{children}</div>
    </div>
  );
}
