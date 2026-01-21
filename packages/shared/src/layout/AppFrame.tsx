import type { ReactNode } from "react";
import { useEffect } from "react";
import styles from "./AppFrame.module.scss";

type AppFrameApp = "music" | "musician" | "muse";

export function AppFrame({
  children,
  app,
}: {
  children: ReactNode;
  app?: AppFrameApp;
}) {
  const appClass =
    app === "music"
      ? styles.appMusic
      : app === "musician"
        ? styles.appMusician
        : app === "muse"
          ? styles.appMuse
          : "";

  useEffect(() => {
    if (!app) return;
    document.body.dataset.taaApp = app;
    return () => {
      if (document.body.dataset.taaApp === app) {
        delete document.body.dataset.taaApp;
      }
    };
  }, [app]);

  return (
    <div className={[styles.root, appClass].filter(Boolean).join(" ")}>
      <div className={styles.container}>{children}</div>
    </div>
  );
}
