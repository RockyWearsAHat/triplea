import { useEffect, useMemo, useState } from "react";
import { AppShell, Button, spacing, useAuth, StatCard } from "@shared";
import { useNavigate } from "react-router-dom";
import ui from "@shared/styles/primitives.module.scss";
import {
  TripleAApiClient,
  type EmployeeInviteSummary,
} from "@shared/api/client";
import { API_BASE_URL } from "../lib/urls";

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: API_BASE_URL }),
    [],
  );
  const { hasPermission } = useAuth();
  const canManageEmployees = hasPermission("manage_employees");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  const [invites, setInvites] = useState<EmployeeInviteSummary[]>([]);
  const [invitesBusy, setInvitesBusy] = useState(false);
  const [invitesError, setInvitesError] = useState<string | null>(null);
  const [revokeBusyId, setRevokeBusyId] = useState<string | null>(null);

  async function loadInvites() {
    if (!canManageEmployees) return;
    setInvitesError(null);
    setInvitesBusy(true);
    try {
      const data = await api.adminListEmployeeInvites();
      setInvites(data);
    } catch (e) {
      setInvitesError(e instanceof Error ? e.message : String(e));
    } finally {
      setInvitesBusy(false);
    }
  }

  async function createEmployeeInvite() {
    if (!canManageEmployees) {
      setInviteError("You do not have permission to manage employees.");
      return;
    }
    setInviteError(null);
    setInviteLink(null);
    setInviteBusy(true);
    try {
      const data = await api.adminCreateEmployeeInvite({
        email: inviteEmail,
        expiresInHours: 24,
        employeeRoles: [],
      });
      const link = `${window.location.origin}/invite?token=${encodeURIComponent(
        data.token,
      )}`;
      setInviteLink(link);
      await loadInvites();
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : String(e));
    } finally {
      setInviteBusy(false);
    }
  }

  async function revokeInvite(inviteId: string) {
    if (!canManageEmployees) {
      setInvitesError("You do not have permission to manage employees.");
      return;
    }
    setInvitesError(null);
    setRevokeBusyId(inviteId);
    try {
      await api.adminRevokeEmployeeInvite(inviteId);
      await loadInvites();
    } catch (e) {
      setInvitesError(e instanceof Error ? e.message : String(e));
    } finally {
      setRevokeBusyId(null);
    }
  }

  useEffect(() => {
    if (!canManageEmployees) return;
    void loadInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageEmployees]);

  return (
    <AppShell
      title="Admin dashboard"
      subtitle="Control access, employees, and high-level operations."
    >
      <div className={ui.pageContent}>
        <section className={ui.section}>
          <h2 className={ui.sectionTitle}>People & access</h2>
          <div className={[ui.card, ui.cardPad].join(" ")}>
            <p className={ui.help}>
              Assign roles like operations, gear tech, and drivers to employees.
              This is where permission-based access will be managed.
            </p>
            <div style={{ marginTop: spacing.md }}>
              <Button
                variant="secondary"
                style={{ alignSelf: "flex-start" }}
                onClick={() => navigate("/admin/users")}
              >
                Manage employees
              </Button>
            </div>
          </div>
        </section>

        <section className={ui.section}>
          <h2 className={ui.sectionTitle}>Employee onboarding</h2>
          <div className={[ui.formCard].join(" ")}>
            <p className={ui.help}>
              Employees can only register via a private, expiring invite link.
              Admin accounts cannot be self-registered.
            </p>

            {!canManageEmployees ? (
              <p className={ui.error}>
                You do not have permission to invite employees.
              </p>
            ) : null}

            <div className={ui.field}>
              <label className={ui.label}>Employee email</label>
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="employee@company.com"
                className={ui.input}
              />
            </div>

            {inviteError && <p className={ui.error}>{inviteError}</p>}

            <Button
              onClick={createEmployeeInvite}
              disabled={
                inviteBusy || !inviteEmail.trim() || !canManageEmployees
              }
            >
              {inviteBusy ? "Creating invite..." : "Create invite link"}
            </Button>

            {inviteLink && (
              <div className={ui.field}>
                <p className={ui.help}>
                  Copy and email this link to the employee:
                </p>
                <input readOnly value={inviteLink} className={ui.input} />
              </div>
            )}

            <div className={ui.divider} />

            <div className={ui.rowBetween}>
              <p className={ui.help}>Recent invites</p>
              <Button
                variant="secondary"
                onClick={loadInvites}
                disabled={invitesBusy || !canManageEmployees}
              >
                {invitesBusy ? "Refreshing..." : "Refresh"}
              </Button>
            </div>

            {invitesError && <p className={ui.error}>{invitesError}</p>}

            <div style={{ overflowX: "auto" }}>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Expires</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {invites.length === 0 && !invitesBusy ? (
                    <tr>
                      <td colSpan={5} className={ui.help}>
                        No invites yet.
                      </td>
                    </tr>
                  ) : (
                    invites.map((inv) => {
                      const now = Date.now();
                      const expiresAtMs = Date.parse(inv.expiresAt);
                      const isExpired = Number.isFinite(expiresAtMs)
                        ? expiresAtMs < now
                        : false;

                      const status = inv.revokedAt
                        ? "Revoked"
                        : inv.usedAt
                          ? "Used"
                          : isExpired
                            ? "Expired"
                            : "Active";

                      const canRevoke = !inv.usedAt && !inv.revokedAt;

                      return (
                        <tr key={inv.id}>
                          <td>{inv.email}</td>
                          <td>
                            <span
                              className={
                                status === "Active"
                                  ? ui.badgeSuccess
                                  : status === "Expired"
                                    ? ui.badgeWarning
                                    : status === "Revoked"
                                      ? ui.badgeError
                                      : ui.badgeNeutral
                              }
                            >
                              {status}
                            </span>
                          </td>
                          <td>{new Date(inv.expiresAt).toLocaleString()}</td>
                          <td>{new Date(inv.createdAt).toLocaleString()}</td>
                          <td style={{ textAlign: "right" }}>
                            {canRevoke ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => revokeInvite(inv.id)}
                                disabled={revokeBusyId === inv.id}
                              >
                                {revokeBusyId === inv.id
                                  ? "Revoking..."
                                  : "Revoke"}
                              </Button>
                            ) : (
                              <span className={ui.help}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className={ui.section}>
          <h2 className={ui.sectionTitle}>Operational overview</h2>
          <div className={ui.statGrid}>
            <StatCard
              title="Active employees"
              value={5}
              subtitle="3 on logistics, 2 on staging."
            />
            <StatCard
              title="Open gear tickets"
              value={4}
              subtitle="2 for tonight, 2 this weekend."
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
