import { useEffect, useMemo, useState } from "react";
import { AppShell, Button, spacing, useAuth } from "@shared";
import { useNavigate } from "react-router-dom";
import ui from "@shared/styles/primitives.module.scss";
import {
  TripleAApiClient,
  type EmployeeInviteSummary,
} from "@shared/api/client";
import { Section } from "../components/Section";
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
      <div
        style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}
      >
        <Section title="People & access">
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
        </Section>

        <Section title="Employee onboarding">
          <div
            className={[ui.card, ui.cardPad].join(" ")}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing.md,
              maxWidth: 520,
            }}
          >
            <p className={ui.help}>
              Employees can only register via a private, expiring invite link.
              Admin accounts cannot be self-registered.
            </p>

            {!canManageEmployees ? (
              <p className={ui.error}>
                You do not have permission to invite employees.
              </p>
            ) : null}

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13 }}>Employee email</label>
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
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <p className={ui.help}>
                  Copy and email this link to the employee:
                </p>
                <input readOnly value={inviteLink} className={ui.input} />
              </div>
            )}

            <hr
              style={{
                border: 0,
                borderTop: "1px solid var(--border)",
                width: "100%",
              }}
            />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: spacing.md,
              }}
            >
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
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        fontSize: 12,
                        color: "var(--text-muted)",
                        paddingBottom: 8,
                      }}
                    >
                      Email
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        fontSize: 12,
                        color: "var(--text-muted)",
                        paddingBottom: 8,
                      }}
                    >
                      Status
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        fontSize: 12,
                        color: "var(--text-muted)",
                        paddingBottom: 8,
                      }}
                    >
                      Expires
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        fontSize: 12,
                        color: "var(--text-muted)",
                        paddingBottom: 8,
                      }}
                    >
                      Created
                    </th>
                    <th style={{ paddingBottom: 8 }} />
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
                          <td
                            style={{
                              padding: "8px 0",
                              borderTop: "1px solid var(--border)",
                              fontSize: 13,
                            }}
                          >
                            {inv.email}
                          </td>
                          <td
                            style={{
                              padding: "8px 0",
                              borderTop: "1px solid var(--border)",
                              fontSize: 13,
                              color: "var(--text-muted)",
                            }}
                          >
                            {status}
                          </td>
                          <td
                            style={{
                              padding: "8px 0",
                              borderTop: "1px solid var(--border)",
                              fontSize: 13,
                              color: "var(--text-muted)",
                            }}
                          >
                            {new Date(inv.expiresAt).toLocaleString()}
                          </td>
                          <td
                            style={{
                              padding: "8px 0",
                              borderTop: "1px solid var(--border)",
                              fontSize: 13,
                              color: "var(--text-muted)",
                            }}
                          >
                            {new Date(inv.createdAt).toLocaleString()}
                          </td>
                          <td
                            style={{
                              padding: "8px 0",
                              borderTop: "1px solid var(--border)",
                              textAlign: "right",
                            }}
                          >
                            {canRevoke ? (
                              <Button
                                variant="secondary"
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
        </Section>

        <Section title="Operational overview">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: spacing.lg,
            }}
          >
            <div className={[ui.card, ui.cardPad].join(" ")}>
              <p className={ui.help}>Active employees</p>
              <p style={{ fontSize: 28, fontWeight: 600 }}>5</p>
              <p className={ui.help}>3 on logistics, 2 on staging.</p>
            </div>
            <div className={[ui.card, ui.cardPad].join(" ")}>
              <p className={ui.help}>Open gear tickets</p>
              <p style={{ fontSize: 28, fontWeight: 600 }}>4</p>
              <p className={ui.help}>2 for tonight, 2 this weekend.</p>
            </div>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
