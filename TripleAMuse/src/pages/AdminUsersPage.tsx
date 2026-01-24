import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { AppShell, Button, spacing } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import type { EmployeeRole, Permission, User, UserRole } from "@shared/types";
import { TripleAApiClient } from "@shared/api/client";
import { API_BASE_URL } from "../lib/urls";

export function AdminUsersPage() {
  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: API_BASE_URL }),
    [],
  );

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .adminListUsers()
      .then((data) => setUsers(data))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [api]);

  const allRoles: UserRole[] = [
    "customer",
    "musician",
    "teacher",
    "rental_provider",
    "admin",
  ];
  const allPermissions: Permission[] = [
    "view_admin_dashboard",
    "manage_employees",
    "view_musician_dashboard",
    "view_customer_dashboard",
    "view_employee_dashboard",
    "manage_gear_requests",
    "manage_venue_ads",
  ];
  const allEmployeeRoles: EmployeeRole[] = [
    "operations_manager",
    "gear_tech",
    "driver",
    "warehouse",
  ];

  function toggleInList<T extends string>(
    list: T[] | undefined,
    value: T,
  ): T[] {
    const current = list ?? [];
    return current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
  }

  async function saveUser(u: User) {
    setSavingId(u.id);
    setError(null);
    try {
      const updated = await api.adminUpdateUser({
        id: u.id,
        roles: u.role,
        permissions: u.permissions ?? [],
        employeeRoles: u.employeeRoles ?? [],
      });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <AppShell
      title="User admin"
      subtitle="Assign roles, permissions, and employee job functions."
    >
      <div
        style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}
      >
        {loading && <p className={ui.help}>Loading users…</p>}
        {error && <p className={ui.error}>{error}</p>}
        {!loading && users.length === 0 && (
          <p className={ui.help}>No users found.</p>
        )}

        {users.map((u) => (
          <div key={u.id} className={[ui.card, ui.cardPad].join(" ")}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: spacing.md,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div style={{ minWidth: 260 }}>
                <p style={{ fontWeight: 600 }}>{u.name}</p>
                <p className={ui.help}>{u.email}</p>
                <p className={ui.help}>ID: {u.id}</p>
              </div>
              <Button
                variant="secondary"
                disabled={savingId === u.id}
                onClick={() => saveUser(u)}
              >
                {savingId === u.id ? "Saving…" : "Save"}
              </Button>
            </div>

            <div
              style={{
                marginTop: spacing.md,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: spacing.lg,
              }}
            >
              <div>
                <p className={ui.label} style={{ marginBottom: 8 }}>
                  Roles
                </p>
                <div
                  className={ui.stack}
                  style={{ "--stack-gap": "6px" } as CSSProperties}
                >
                  {allRoles.map((r) => (
                    <label key={r} className={ui.checkboxLabel}>
                      <input
                        type="checkbox"
                        className={ui.checkbox}
                        checked={u.role.includes(r)}
                        onChange={() =>
                          setUsers((prev) =>
                            prev.map((x) =>
                              x.id === u.id
                                ? { ...x, role: toggleInList(x.role, r) }
                                : x,
                            ),
                          )
                        }
                      />
                      {r}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className={ui.label} style={{ marginBottom: 8 }}>
                  Permissions
                </p>
                <div
                  className={ui.stack}
                  style={{ "--stack-gap": "6px" } as CSSProperties}
                >
                  {allPermissions.map((p) => (
                    <label key={p} className={ui.checkboxLabel}>
                      <input
                        type="checkbox"
                        className={ui.checkbox}
                        checked={(u.permissions ?? []).includes(p)}
                        onChange={() =>
                          setUsers((prev) =>
                            prev.map((x) =>
                              x.id === u.id
                                ? {
                                    ...x,
                                    permissions: toggleInList(
                                      x.permissions ?? [],
                                      p,
                                    ),
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                      {p}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className={ui.label} style={{ marginBottom: 8 }}>
                  Employee roles
                </p>
                <p className={ui.help} style={{ marginBottom: 8 }}>
                  Only relevant for internal employees.
                </p>
                <div
                  className={ui.stack}
                  style={{ "--stack-gap": "6px" } as CSSProperties}
                >
                  {allEmployeeRoles.map((er) => (
                    <label key={er} className={ui.checkboxLabel}>
                      <input
                        type="checkbox"
                        className={ui.checkbox}
                        checked={(u.employeeRoles ?? []).includes(er)}
                        onChange={() =>
                          setUsers((prev) =>
                            prev.map((x) =>
                              x.id === u.id
                                ? {
                                    ...x,
                                    employeeRoles: toggleInList(
                                      x.employeeRoles ?? [],
                                      er,
                                    ),
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                      {er}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
