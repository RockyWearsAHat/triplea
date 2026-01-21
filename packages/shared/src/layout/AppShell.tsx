import type { ReactNode } from "react";
import { useEffect } from "react";
import styles from "./AppShell.module.scss";

interface AppShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AppShell({ title, subtitle, children }: AppShellProps) {
  useEffect(() => {
    const app = document.body.dataset.taaApp;
    const appName =
      app === "music"
        ? "Triple A Music"
        : app === "musician"
          ? "Triple A Musician"
          : app === "muse"
            ? "Triple A Muse"
            : "Triple A";

    const trimmedTitle = title?.trim() || appName;
    document.title =
      trimmedTitle.toLowerCase() === appName.toLowerCase()
        ? appName
        : `${trimmedTitle} · ${appName}`;
  }, [title]);

  return (
    <section className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </header>
      <main className={styles.main}>{children}</main>
    </section>
  );
}
