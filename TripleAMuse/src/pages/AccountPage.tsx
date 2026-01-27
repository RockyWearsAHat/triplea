import React, { useState, useEffect } from "react";
import {
  AppShell,
  Button,
  useAuthGuard,
  AuthLoadingScreen,
  useAuth,
} from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import { useNavigate, Link } from "react-router-dom";
import styles from "./AccountPage.module.scss";

/* ────────────────────────────────────────────────────────────────────────────
   Account Page — Professional, visual-first account management
   Sections: Profile, Security, Roles, Linked Apps, Notifications
   ──────────────────────────────────────────────────────────────────────────── */

function ProfileAvatar({ name, size = 72 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={styles.avatar}
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

function SettingRow({
  label,
  value,
  action,
  onAction,
}: {
  label: string;
  value: string | React.ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className={styles.settingRow}>
      <div className={styles.settingInfo}>
        <span className={styles.settingLabel}>{label}</span>
        <span className={styles.settingValue}>{value}</span>
      </div>
      {action && onAction && (
        <Button variant="ghost" size="sm" onClick={onAction}>
          {action}
        </Button>
      )}
    </div>
  );
}

export function AccountPage() {
  const { isReady, isAuthenticated, user } = useAuthGuard();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [showingPasswordSection, setShowingPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Wait for auth to be verified, then redirect if not authenticated
  useEffect(() => {
    if (isReady && !isAuthenticated) {
      navigate("/login");
    }
  }, [isReady, isAuthenticated, navigate]);

  // Show loading screen while verifying auth
  if (!isReady) {
    return <AuthLoadingScreen />;
  }

  // After ready, if not authenticated, show nothing (redirect is happening)
  if (!user) {
    return null;
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    // TODO: Implement actual password change API call
    // For now, show success message
    setPasswordSuccess(true);
    setShowingPasswordSection(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const linkedApps = [
    {
      name: "Triple A Music",
      description: "Browse events & buy tickets",
      url: "https://tripleamusic.org",
      active: true,
      needsRegistration: false,
    },
    {
      name: "Triple A Musician",
      description: "Performer dashboard",
      url: "https://tripleamusician.org",
      active: user.role.includes("musician"),
      needsRegistration: !user.role.includes("musician"),
    },
    {
      name: "Host",
      description: "Post events & manage venues",
      url: "https://tripleamusic.org/host",
      active: user.role.includes("customer"),
      needsRegistration: !user.role.includes("customer"),
    },
  ];

  return (
    <AppShell title="Account" subtitle="Manage your profile and settings">
      <div className={styles.accountGrid}>
        {/* Profile Card */}
        <div className={`${ui.card} ${styles.profileCard}`}>
          <div className={styles.profileHeader}>
            <ProfileAvatar name={user.name} size={80} />
            <div className={styles.profileInfo}>
              <h2 className={styles.profileName}>{user.name}</h2>
              <p className={styles.profileEmail}>{user.email}</p>
              <p className={styles.profileMeta}>
                Member since{" "}
                {new Date().toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Settings Card */}
        <div className={`${ui.card} ${styles.settingsCard}`}>
          <h3 className={styles.cardTitle}>Account settings</h3>

          <div className={styles.settingsGroup}>
            <SettingRow
              label="Display name"
              value={user.name}
              action="Edit"
              onAction={() => {
                /* TODO: Open edit name modal */
              }}
            />
            <SettingRow
              label="Email address"
              value={user.email}
              action="Change"
              onAction={() => {
                /* TODO: Open change email modal */
              }}
            />
            <SettingRow
              label="Password"
              value="••••••••"
              action={showingPasswordSection ? "Cancel" : "Update"}
              onAction={() =>
                setShowingPasswordSection(!showingPasswordSection)
              }
            />
          </div>

          {showingPasswordSection && (
            <form
              onSubmit={handlePasswordChange}
              className={styles.passwordForm}
            >
              <div className={ui.field}>
                <label className={ui.label}>Current password</label>
                <input
                  type="password"
                  className={ui.input}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className={ui.field}>
                <label className={ui.label}>New password</label>
                <input
                  type="password"
                  className={ui.input}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <p className={ui.help}>Minimum 8 characters</p>
              </div>
              <div className={ui.field}>
                <label className={ui.label}>Confirm new password</label>
                <input
                  type="password"
                  className={ui.input}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              {passwordError && <p className={ui.error}>{passwordError}</p>}
              <Button type="submit" variant="primary" size="sm">
                Update password
              </Button>
            </form>
          )}

          {passwordSuccess && (
            <p className={ui.success}>Password updated successfully</p>
          )}
        </div>

        {/* Linked Apps Card */}
        <div className={`${ui.card} ${styles.appsCard}`}>
          <h3 className={styles.cardTitle}>Triple A apps</h3>
          <p className={ui.help}>Your account works across all Triple A apps</p>

          <div className={styles.appsList}>
            {linkedApps.map((app) => (
              <a
                key={app.name}
                href={app.url}
                className={`${styles.appLink} ${app.active ? styles.appLinkActive : ""}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className={styles.appIcon}>
                  {app.name.split(" ").pop()?.charAt(0)}
                </div>
                <div className={styles.appInfo}>
                  <span className={styles.appName}>{app.name}</span>
                  <span className={styles.appRole}>
                    {app.needsRegistration ? "Not activated" : app.description}
                  </span>
                </div>
                <span className={styles.appArrow}>→</span>
              </a>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className={`${ui.card} ${styles.actionsCard}`}>
          <h3 className={styles.cardTitle}>Quick actions</h3>

          <div className={styles.actionsList}>
            {user.role.includes("musician") && (
              <Link to="/dashboard" className={styles.actionLink}>
                <span className={styles.actionIcon}>🎵</span>
                <span>View musician dashboard</span>
              </Link>
            )}
            {user.role.includes("customer") && (
              <Link to="/dashboard" className={styles.actionLink}>
                <span className={styles.actionIcon}>📅</span>
                <span>Manage your events</span>
              </Link>
            )}
            <Link to="/messages" className={styles.actionLink}>
              <span className={styles.actionIcon}>💬</span>
              <span>Messages</span>
            </Link>
            {(user.role.includes("admin") ||
              user.role.includes("rental_provider")) && (
              <Link to="/admin" className={styles.actionLink}>
                <span className={styles.actionIcon}>⚙️</span>
                <span>Admin dashboard</span>
              </Link>
            )}
          </div>

          <div className={ui.divider} style={{ margin: "16px 0" }} />

          <Button
            variant="secondary"
            onClick={logout}
            style={{ width: "100%" }}
          >
            Sign out
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
