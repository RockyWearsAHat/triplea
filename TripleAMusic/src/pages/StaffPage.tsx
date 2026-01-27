import { useEffect, useMemo, useState } from "react";
import type { StaffMember, StaffPermission } from "@shared";
import { Button, useAuth } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import { createApiClient } from "../lib/urls";
import { HostDashboardShell } from "../components/HostDashboardShell";
import styles from "./StaffPage.module.scss";
import {
  UserPlus,
  Mail,
  Shield,
  Trash2,
  RefreshCw,
  Check,
  Clock,
  X,
  Pencil,
} from "lucide-react";

const PERMISSION_LABELS: Record<StaffPermission, string> = {
  scan_tickets: "Scan Tickets",
  view_sales: "View Sales",
  manage_events: "Manage Events",
  manage_venues: "Manage Venues",
  send_messages: "Send Messages",
};

const ALL_PERMISSIONS: StaffPermission[] = [
  "scan_tickets",
  "view_sales",
  "manage_events",
  "manage_venues",
  "send_messages",
];

export function StaffPage() {
  const api = useMemo(() => createApiClient(), []);
  const { user } = useAuth();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite form state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePermissions, setInvitePermissions] = useState<StaffPermission[]>(
    ["scan_tickets"],
  );
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPermissions, setEditPermissions] = useState<StaffPermission[]>([]);

  // Edit email state (for pending invites)
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editEmailError, setEditEmailError] = useState<string | null>(null);
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadStaff();
  }, [user]);

  const loadStaff = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listStaff();
      setStaff(data);
    } catch {
      setError("Failed to load staff members");
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      setInviting(true);
      setInviteError(null);
      await api.inviteStaff({
        email: inviteEmail.trim(),
        permissions: invitePermissions,
        staffName: inviteName.trim() || undefined,
      });
      setInviteEmail("");
      setInviteName("");
      setInvitePermissions(["scan_tickets"]);
      setShowInviteForm(false);
      await loadStaff();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to send invite";
      setInviteError(message);
    } finally {
      setInviting(false);
    }
  };

  const handleResend = async (id: string) => {
    try {
      await api.resendStaffInvite(id);
      await loadStaff();
    } catch {
      // Handle error silently or show toast
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Are you sure you want to remove this staff member?")) return;
    try {
      await api.removeStaffMember(id);
      await loadStaff();
    } catch {
      // Handle error
    }
  };

  const handleStartEditEmail = (member: StaffMember) => {
    setEditingEmailId(member.id);
    setEditEmail(member.email);
    setEditEmailError(null);
  };

  const handleCancelEditEmail = () => {
    setEditingEmailId(null);
    setEditEmail("");
    setEditEmailError(null);
  };

  const handleSaveEmail = async (id: string) => {
    if (!editEmail.trim()) return;
    try {
      setSavingEmail(true);
      setEditEmailError(null);
      await api.updateStaffInviteEmail(id, editEmail.trim());
      setEditingEmailId(null);
      setEditEmail("");
      await loadStaff();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update email";
      setEditEmailError(message);
    } finally {
      setSavingEmail(false);
    }
  };

  const handleStartEdit = (member: StaffMember) => {
    setEditingId(member.id);
    setEditPermissions([...member.permissions]);
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await api.updateStaffMember(id, { permissions: editPermissions });
      setEditingId(null);
      await loadStaff();
    } catch {
      // Handle error
    }
  };

  const togglePermission = (
    perms: StaffPermission[],
    perm: StaffPermission,
    setter: (p: StaffPermission[]) => void,
  ) => {
    if (perms.includes(perm)) {
      setter(perms.filter((p) => p !== perm));
    } else {
      setter([...perms, perm]);
    }
  };

  const pendingInvites = staff.filter((s) => s.status === "pending");
  const activeStaff = staff.filter((s) => s.status === "accepted");

  if (loading) {
    return (
      <HostDashboardShell title="Staff" subtitle="Manage your event team">
        <p className={ui.help}>Loading staff...</p>
      </HostDashboardShell>
    );
  }

  return (
    <HostDashboardShell title="Staff" subtitle="Manage your event team">
      <div className={styles.staffPage}>
        {/* Header with invite button */}
        <div className={styles.pageHeader}>
          <p className={ui.help}>
            Invite team members to help manage your events. They can scan
            tickets, view sales, and more.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowInviteForm(!showInviteForm)}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <UserPlus size={14} />
            {showInviteForm ? "Cancel" : "Invite Staff"}
          </Button>
        </div>

        {/* Invite Form */}
        {showInviteForm && (
          <form onSubmit={handleInvite} className={styles.inviteForm}>
            <h3 className={styles.formTitle}>Invite New Staff Member</h3>

            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Email Address *</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="team@example.com"
                  className={ui.input}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Name (optional)</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Staff member name"
                  className={ui.input}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Permissions</label>
              <div className={styles.permissionGrid}>
                {ALL_PERMISSIONS.map((perm) => (
                  <label key={perm} className={styles.permissionCheckbox}>
                    <input
                      type="checkbox"
                      checked={invitePermissions.includes(perm)}
                      onChange={() =>
                        togglePermission(
                          invitePermissions,
                          perm,
                          setInvitePermissions,
                        )
                      }
                    />
                    <span>{PERMISSION_LABELS[perm]}</span>
                  </label>
                ))}
              </div>
            </div>

            {inviteError && <p className={ui.error}>{inviteError}</p>}

            <div className={styles.formActions}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowInviteForm(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={inviting || !inviteEmail.trim()}
              >
                {inviting ? "Sending..." : "Send Invite"}
              </Button>
            </div>
          </form>
        )}

        {error && <p className={ui.error}>{error}</p>}

        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <Clock size={16} />
              Pending Invites ({pendingInvites.length})
            </h3>
            <div className={styles.staffList}>
              {pendingInvites.map((member) => (
                <div key={member.id} className={styles.staffCard}>
                  <div className={styles.staffInfo}>
                    <div className={styles.staffAvatar}>
                      <Mail size={16} />
                    </div>
                    <div>
                      <p className={styles.staffName}>
                        {member.staffName || member.email}
                      </p>
                      {editingEmailId === member.id ? (
                        <div className={styles.editEmailForm}>
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            placeholder="new@email.com"
                            className={ui.input}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleSaveEmail(member.id);
                              } else if (e.key === "Escape") {
                                handleCancelEditEmail();
                              }
                            }}
                          />
                          {editEmailError && (
                            <p className={ui.error} style={{ marginTop: 4 }}>
                              {editEmailError}
                            </p>
                          )}
                          <div className={styles.editEmailActions}>
                            <button
                              className={styles.iconButton}
                              onClick={() => handleSaveEmail(member.id)}
                              title="Save"
                              type="button"
                              disabled={savingEmail}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              className={styles.iconButton}
                              onClick={handleCancelEditEmail}
                              title="Cancel"
                              type="button"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className={styles.staffEmail}>
                            {member.email}
                            <button
                              className={styles.inlineEditButton}
                              onClick={() => handleStartEditEmail(member)}
                              title="Edit email"
                              type="button"
                            >
                              <Pencil size={12} />
                            </button>
                          </p>
                        </>
                      )}
                      <p className={styles.staffMeta}>
                        Expires:{" "}
                        {member.expiresAt
                          ? new Date(member.expiresAt).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className={styles.staffPermissions}>
                    {member.permissions.map((p) => (
                      <span key={p} className={styles.permissionBadge}>
                        {PERMISSION_LABELS[p]}
                      </span>
                    ))}
                  </div>
                  <div className={styles.staffActions}>
                    <button
                      className={styles.iconButton}
                      onClick={() => handleResend(member.id)}
                      title="Resend invite"
                      type="button"
                    >
                      <RefreshCw size={14} />
                    </button>
                    <button
                      className={styles.iconButtonDanger}
                      onClick={() => handleRemove(member.id)}
                      title="Revoke invite"
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Active Staff */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <Shield size={16} />
            Active Staff ({activeStaff.length})
          </h3>

          {activeStaff.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No active staff members yet.</p>
              <p className={ui.help}>
                Invite your first team member to get started.
              </p>
            </div>
          ) : (
            <div className={styles.staffList}>
              {activeStaff.map((member) => (
                <div key={member.id} className={styles.staffCard}>
                  <div className={styles.staffInfo}>
                    <div className={styles.staffAvatarActive}>
                      <Check size={16} />
                    </div>
                    <div>
                      <p className={styles.staffName}>
                        {member.staffName || member.email}
                      </p>
                      <p className={styles.staffEmail}>{member.email}</p>
                      <p className={styles.staffMeta}>
                        Joined:{" "}
                        {member.acceptedAt
                          ? new Date(member.acceptedAt).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>
                  </div>

                  {editingId === member.id ? (
                    <>
                      <div className={styles.permissionGrid}>
                        {ALL_PERMISSIONS.map((perm) => (
                          <label
                            key={perm}
                            className={styles.permissionCheckbox}
                          >
                            <input
                              type="checkbox"
                              checked={editPermissions.includes(perm)}
                              onChange={() =>
                                togglePermission(
                                  editPermissions,
                                  perm,
                                  setEditPermissions,
                                )
                              }
                            />
                            <span>{PERMISSION_LABELS[perm]}</span>
                          </label>
                        ))}
                      </div>
                      <div className={styles.staffActions}>
                        <button
                          className={styles.iconButton}
                          onClick={() => handleSaveEdit(member.id)}
                          title="Save"
                          type="button"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          className={styles.iconButton}
                          onClick={() => setEditingId(null)}
                          title="Cancel"
                          type="button"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={styles.staffPermissions}>
                        {member.permissions.map((p) => (
                          <span key={p} className={styles.permissionBadge}>
                            {PERMISSION_LABELS[p]}
                          </span>
                        ))}
                      </div>
                      <div className={styles.staffActions}>
                        <button
                          className={styles.iconButton}
                          onClick={() => handleStartEdit(member)}
                          title="Edit permissions"
                          type="button"
                        >
                          <Shield size={14} />
                        </button>
                        <button
                          className={styles.iconButtonDanger}
                          onClick={() => handleRemove(member.id)}
                          title="Remove staff"
                          type="button"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </HostDashboardShell>
  );
}

export default StaffPage;
