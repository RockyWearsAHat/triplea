import React, { useEffect, useMemo, useState } from "react";
import type { StaffPermission } from "@shared";
import { Button, useAuth } from "@shared";
import { useNavigate, useParams, Link } from "react-router-dom";
import ui from "@shared/styles/primitives.module.scss";
import { createApiClient } from "../lib/urls";
import styles from "./StaffJoinPage.module.scss";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ScanLine,
  BarChart3,
  Calendar,
  MapPin,
  MessageSquare,
  Building2,
} from "lucide-react";

const PERMISSION_LABELS: Record<
  StaffPermission,
  { label: string; description: string; icon: React.ReactNode }
> = {
  scan_tickets: {
    label: "Scan Tickets",
    description: "Validate tickets at event entrances",
    icon: <ScanLine size={16} />,
  },
  view_sales: {
    label: "View Sales",
    description: "See ticket sales and revenue data",
    icon: <BarChart3 size={16} />,
  },
  manage_events: {
    label: "Manage Events",
    description: "Create, edit, and cancel events",
    icon: <Calendar size={16} />,
  },
  manage_venues: {
    label: "Manage Venues",
    description: "Add and edit venue locations",
    icon: <MapPin size={16} />,
  },
  send_messages: {
    label: "Send Messages",
    description: "Communicate with artists and customers",
    icon: <MessageSquare size={16} />,
  },
};

interface InviteInfo {
  email: string;
  permissions: StaffPermission[];
  hostName: string;
  isExistingUser: boolean;
}

export default function StaffJoinPage() {
  const api = useMemo(() => createApiClient(), []);
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const { user, login } = useAuth();

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // For existing user linking
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // For new user registration
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");

  // Success state
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid invite link");
      setLoading(false);
      return;
    }

    api
      .getStaffInviteInfo(token)
      .then((data) => {
        setInviteInfo(data.invite);
      })
      .catch((err) => {
        setError(err.message || "Failed to load invite");
      })
      .finally(() => setLoading(false));
  }, [api, token]);

  async function handleLinkAccount() {
    if (!token) return;
    setLinking(true);
    setLinkError(null);

    try {
      await api.acceptStaffInvite(token);
      setSuccess(true);
    } catch (err: unknown) {
      setLinkError(
        err instanceof Error ? err.message : "Failed to link account",
      );
    } finally {
      setLinking(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !inviteInfo) return;

    if (password !== confirmPassword) {
      setRegisterError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setRegisterError("Password must be at least 8 characters");
      return;
    }

    setRegistering(true);
    setRegisterError(null);

    try {
      await api.registerAndAcceptStaffInvite(token, {
        name: name || inviteInfo.email.split("@")[0],
        password,
      });
      // Log in the user after registration
      await login(inviteInfo.email, password);
      setSuccess(true);
    } catch (err: unknown) {
      setRegisterError(
        err instanceof Error ? err.message : "Failed to create account",
      );
    } finally {
      setRegistering(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.loading}>
            <Loader2 size={32} className={styles.spinner} />
            <p>Loading invite...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !inviteInfo) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.errorState}>
            <AlertCircle size={48} />
            <h2>Invalid or Expired Invite</h2>
            <p>{error || "This invite link is no longer valid."}</p>
            <Link to="/" className={styles.homeLink}>
              Go to Triple A Music
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.successState}>
            <CheckCircle2 size={48} />
            <h2>Welcome to the Team!</h2>
            <p>
              You've been added as staff for{" "}
              <strong>{inviteInfo.hostName}</strong>.
            </p>
            <Button variant="primary" onClick={() => navigate("/manage")}>
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // If user is already logged in and it's for an existing user
  if (user && inviteInfo.isExistingUser) {
    // Check if logged-in user matches the invite email
    const emailMatches =
      user.email.toLowerCase() === inviteInfo.email.toLowerCase();

    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.header}>
            <Building2 size={40} />
            <h1>Staff Invitation</h1>
          </div>

          <div className={styles.inviteDetails}>
            <p className={styles.invitedBy}>
              <strong>{inviteInfo.hostName}</strong> has invited you to join
              their team.
            </p>

            <div className={styles.permissionsSection}>
              <h3>Your Permissions</h3>
              <div className={styles.permissionsList}>
                {inviteInfo.permissions.map((perm) => (
                  <div key={perm} className={styles.permissionItem}>
                    {PERMISSION_LABELS[perm]?.icon}
                    <div>
                      <p className={styles.permissionLabel}>
                        {PERMISSION_LABELS[perm]?.label}
                      </p>
                      <p className={styles.permissionDesc}>
                        {PERMISSION_LABELS[perm]?.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {emailMatches ? (
            <div className={styles.actionSection}>
              <p className={styles.loggedInAs}>
                Logged in as <strong>{user.email}</strong>
              </p>
              {linkError && <p className={ui.error}>{linkError}</p>}
              <Button
                variant="primary"
                onClick={handleLinkAccount}
                disabled={linking}
              >
                {linking ? "Joining..." : "Accept & Join Team"}
              </Button>
            </div>
          ) : (
            <div className={styles.actionSection}>
              <p className={ui.error}>
                This invite is for <strong>{inviteInfo.email}</strong>, but
                you're logged in as <strong>{user.email}</strong>.
              </p>
              <p className={ui.help}>
                Please log out and sign in with the correct account, or contact
                the host to update the invite.
              </p>
              <Button
                variant="secondary"
                onClick={() => navigate(`/login?next=/staff/join/${token}`)}
              >
                Switch Account
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // If user is logged in but invite expects a new user
  if (user && !inviteInfo.isExistingUser) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.header}>
            <Building2 size={40} />
            <h1>Staff Invitation</h1>
          </div>

          <div className={styles.inviteDetails}>
            <p className={styles.invitedBy}>
              <strong>{inviteInfo.hostName}</strong> has invited{" "}
              <strong>{inviteInfo.email}</strong> to join their team.
            </p>
          </div>

          <div className={styles.actionSection}>
            <p className={ui.help}>
              You're currently logged in as <strong>{user.email}</strong>.
            </p>
            <p className={ui.help}>
              Log out to create a new account for the invited email, or contact
              the host to update the invite to your current email.
            </p>
            <Button
              variant="secondary"
              onClick={() => navigate(`/login?next=/staff/join/${token}`)}
            >
              Switch Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Not logged in - show appropriate form
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Building2 size={40} />
          <h1>Staff Invitation</h1>
        </div>

        <div className={styles.inviteDetails}>
          <p className={styles.invitedBy}>
            <strong>{inviteInfo.hostName}</strong> has invited you to join their
            team as staff.
          </p>

          <div className={styles.permissionsSection}>
            <h3>Your Permissions</h3>
            <div className={styles.permissionsList}>
              {inviteInfo.permissions.map((perm) => (
                <div key={perm} className={styles.permissionItem}>
                  {PERMISSION_LABELS[perm]?.icon}
                  <div>
                    <p className={styles.permissionLabel}>
                      {PERMISSION_LABELS[perm]?.label}
                    </p>
                    <p className={styles.permissionDesc}>
                      {PERMISSION_LABELS[perm]?.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {inviteInfo.isExistingUser ? (
          // Existing user - prompt to log in
          <div className={styles.actionSection}>
            <p className={ui.help}>
              An account already exists for <strong>{inviteInfo.email}</strong>.
              Please log in to accept this invitation.
            </p>
            <Button
              variant="primary"
              onClick={() => navigate(`/login?next=/staff/join/${token}`)}
            >
              Log In to Accept
            </Button>
          </div>
        ) : (
          // New user - registration form
          <form onSubmit={handleRegister} className={styles.registerForm}>
            <h3>Create Your Account</h3>
            <p className={ui.help}>Set up your account to join the team.</p>

            <div className={styles.formField}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={inviteInfo.email}
                disabled
                className={ui.input}
              />
            </div>

            <div className={styles.formField}>
              <label htmlFor="name">Name (optional)</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className={ui.input}
              />
            </div>

            <div className={styles.formField}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
                className={ui.input}
              />
            </div>

            <div className={styles.formField}>
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                className={ui.input}
              />
            </div>

            {registerError && <p className={ui.error}>{registerError}</p>}

            <Button type="submit" variant="primary" disabled={registering}>
              {registering ? "Creating Account..." : "Create Account & Join"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
