import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AppShell } from "@shared";
import styles from "./HostDashboardShell.module.scss";
import { CalendarDays, ScanLine, Ticket, MapPin, Users } from "lucide-react";

interface Tab {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  {
    id: "overview",
    label: "Overview",
    path: "/manage",
    icon: <CalendarDays size={16} />,
  },
  {
    id: "gigs",
    label: "My Gigs",
    path: "/my-gigs",
    icon: <Ticket size={16} />,
  },
  {
    id: "venues",
    label: "Venues",
    path: "/venues",
    icon: <MapPin size={16} />,
  },
  { id: "staff", label: "Staff", path: "/staff", icon: <Users size={16} /> },
  {
    id: "scanner",
    label: "Scanner",
    path: "/scan-tickets",
    icon: <ScanLine size={16} />,
  },
];

interface HostDashboardShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Hide the tab bar (e.g., for full-screen scanner mode) */
  hideTabs?: boolean;
}

export function HostDashboardShell({
  title,
  subtitle,
  children,
  hideTabs = false,
}: HostDashboardShellProps) {
  const location = useLocation();

  // Determine which tab is active based on current path
  const getActiveTab = () => {
    const path = location.pathname;
    // Exact match first
    const exactMatch = TABS.find((t) => t.path === path);
    if (exactMatch) return exactMatch.id;
    // Prefix match for nested routes
    const prefixMatch = TABS.find(
      (t) => t.path !== "/manage" && path.startsWith(t.path),
    );
    if (prefixMatch) return prefixMatch.id;
    return "overview";
  };

  const activeTabId = getActiveTab();

  return (
    <AppShell title={title} subtitle={subtitle}>
      <div className={styles.container}>
        {!hideTabs && (
          <nav className={styles.tabs} aria-label="Host dashboard navigation">
            {TABS.map((tab) => (
              <NavLink
                key={tab.id}
                to={tab.path}
                className={`${styles.tab} ${activeTabId === tab.id ? styles.tabActive : ""}`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </NavLink>
            ))}
          </nav>
        )}
        <div className={styles.content}>{children}</div>
      </div>
    </AppShell>
  );
}

export default HostDashboardShell;
