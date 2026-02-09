import React, { useState, useEffect } from "react";
import { AppShell, Button, useAuth, getMusicOrigin } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import { useNavigate, Link } from "react-router-dom";
import styles from "./ProfilePage.module.scss";
import { createApiClient } from "../lib/urls";

/* ────────────────────────────────────────────────────────────────────────────
   Profile Page — Triple A Musician
   Professional musician account & profile management
   Note: This page is wrapped by RequireRole which handles auth loading/redirect
   ──────────────────────────────────────────────────────────────────────────── */

interface MusicianProfile {
  id: string;
  userId: string;
  instruments: string[];
  genres: string[];
  bio?: string;
  averageRating: number;
  reviewCount: number;
  defaultHourlyRate?: number;
  acceptsDirectRequests?: boolean;
}

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

function StarRating({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;

  return (
    <div className={styles.starRating}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={`${styles.star} ${star <= fullStars ? styles.starFull : star === fullStars + 1 && hasHalf ? styles.starHalf : ""}`}
        >
          ★
        </span>
      ))}
      <span className={styles.ratingNumber}>{rating.toFixed(1)}</span>
    </div>
  );
}

export function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<MusicianProfile | null>(null);
  const [showingPasswordSection, setShowingPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const api = createApiClient();

  // Note: Auth loading/redirect is handled by RequireRole wrapper
  useEffect(() => {
    if (!user) return;

    // Fetch musician profile
    async function fetchProfile() {
      try {
        const data = await api.getMyMusicianProfile();
        setProfile(data);
      } catch (err) {
        // Profile fetch failed - user may need to complete onboarding
      }
    }

    fetchProfile();
  }, [user]);

  // If no user yet (shouldn't happen because of RequireRole wrapper, but safety)
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
    setPasswordSuccess(true);
    setShowingPasswordSection(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const isHost = user.role.includes("customer");

  const linkedApps = [
    {
      name: "Triple A Musician",
      description: "Performer dashboard",
      url: "/",
      active: true,
      current: true,
      needsRegistration: false,
    },
    {
      name: "Triple A Music",
      description: "Browse events & buy tickets",
      url: getMusicOrigin(),
      active: true,
      needsRegistration: false,
    },
    {
      name: "Host",
      description: "Post events & manage venues",
      // Go to Music onboarding if not set up, or /manage if onboarded
      url: isHost
        ? user.stripeChargesEnabled && user.stripePayoutsEnabled
          ? `${getMusicOrigin()}/manage`
          : `${getMusicOrigin()}/onboarding`
        : `${getMusicOrigin()}/register?become=host`,
      active: isHost,
      needsRegistration: !isHost,
    },
  ];

  return (
    <AppShell
      title="Profile"
      subtitle="Manage your musician account and settings"
    >
      <div className={styles.profileGrid}>
        {/* Profile Card */}
        <div className={`${ui.card} ${styles.profileCard}`}>
          <div className={styles.profileHeader}>
            <ProfileAvatar name={user.name} size={80} />
            <div className={styles.profileInfo}>
              <h2 className={styles.profileName}>{user.name}</h2>
              <p className={styles.profileEmail}>{user.email}</p>
              {profile && (
                <div className={styles.profileStats}>
                  <StarRating rating={profile.averageRating} />
                  <span className={styles.reviewCount}>
                    {profile.reviewCount} review
                    {profile.reviewCount !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Musician Profile Card */}
        {profile && (
          <div className={`${ui.card} ${styles.musicianCard}`}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Musician profile</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard")}
              >
                Edit
              </Button>
            </div>

            <div className={styles.profileDetails}>
              <div className={styles.detailGroup}>
                <span className={styles.detailLabel}>Instruments</span>
                <div className={styles.chipList}>
                  {profile.instruments.length > 0 ? (
                    profile.instruments.map((inst) => (
                      <span key={inst} className={styles.chip}>
                        {inst}
                      </span>
                    ))
                  ) : (
                    <span className={styles.emptyText}>Not specified</span>
                  )}
                </div>
              </div>

              <div className={styles.detailGroup}>
                <span className={styles.detailLabel}>Genres</span>
                <div className={styles.chipList}>
                  {profile.genres.length > 0 ? (
                    profile.genres.map((genre) => (
                      <span key={genre} className={styles.chip}>
                        {genre}
                      </span>
                    ))
                  ) : (
                    <span className={styles.emptyText}>Not specified</span>
                  )}
                </div>
              </div>

              {profile.bio && (
                <div className={styles.detailGroup}>
                  <span className={styles.detailLabel}>Bio</span>
                  <p className={styles.bioText}>{profile.bio}</p>
                </div>
              )}

              <div className={styles.detailRow}>
                <div className={styles.detailGroup}>
                  <span className={styles.detailLabel}>Hourly rate</span>
                  <span className={styles.detailValue}>
                    {profile.defaultHourlyRate
                      ? `$${profile.defaultHourlyRate}`
                      : "Not set"}
                  </span>
                </div>
                <div className={styles.detailGroup}>
                  <span className={styles.detailLabel}>Direct requests</span>
                  <span
                    className={`${styles.detailValue} ${profile.acceptsDirectRequests ? styles.active : ""}`}
                  >
                    {profile.acceptsDirectRequests
                      ? "Accepting"
                      : "Not accepting"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Account Settings Card */}
        <div className={`${ui.card} ${styles.settingsCard}`}>
          <h3 className={styles.cardTitle}>Account settings</h3>

          <div className={styles.settingsGroup}>
            <SettingRow
              label="Display name"
              value={user.name}
              action="Edit"
              onAction={() => {
                /* TODO */
              }}
            />
            <SettingRow
              label="Email address"
              value={user.email}
              action="Change"
              onAction={() => {
                /* TODO */
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

        {/* Quick Actions */}
        <div className={`${ui.card} ${styles.actionsCard}`}>
          <h3 className={styles.cardTitle}>Quick actions</h3>

          <div className={styles.actionsList}>
            <Link to="/dashboard" className={styles.actionLink}>
              <span className={styles.actionIcon}>📊</span>
              <span>View dashboard</span>
            </Link>
            <Link to="/bookings" className={styles.actionLink}>
              <span className={styles.actionIcon}>📅</span>
              <span>Upcoming bookings</span>
            </Link>
            <Link to="/gigs" className={styles.actionLink}>
              <span className={styles.actionIcon}>🎤</span>
              <span>Browse gigs</span>
            </Link>
            <Link to="/perks" className={styles.actionLink}>
              <span className={styles.actionIcon}>⭐</span>
              <span>Your perks</span>
            </Link>
            <Link to="/messages" className={styles.actionLink}>
              <span className={styles.actionIcon}>💬</span>
              <span>Messages</span>
            </Link>
          </div>
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
                className={`${styles.appLink} ${app.active ? styles.appLinkActive : ""} ${app.current ? styles.appLinkCurrent : ""}`}
                target={app.current ? undefined : "_blank"}
                rel={app.current ? undefined : "noopener noreferrer"}
              >
                <div className={styles.appIcon}>
                  {app.name.split(" ").pop()?.charAt(0)}
                </div>
                <div className={styles.appInfo}>
                  <span className={styles.appName}>{app.name}</span>
                  <span className={styles.appRole}>
                    {app.current
                      ? "You're here"
                      : app.needsRegistration
                        ? "Not activated"
                        : app.description}
                  </span>
                </div>
                {!app.current && <span className={styles.appArrow}>→</span>}
              </a>
            ))}
          </div>
        </div>

        {/* Sign Out */}
        <div className={styles.signOutSection}>
          <Button variant="secondary" onClick={logout}>
            Sign out
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

export default ProfilePage;
