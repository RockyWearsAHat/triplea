export type Role =
  | "musician"
  | "customer"
  | "teacher"
  | "rental_provider"
  | "admin";

export type Permission =
  | "view_admin_dashboard"
  | "manage_employees"
  | "view_musician_dashboard"
  | "view_customer_dashboard"
  | "view_employee_dashboard"
  | "manage_gear_requests"
  | "manage_venue_ads";

export type EmployeeRole =
  | "operations_manager"
  | "gear_tech"
  | "driver"
  | "warehouse";

const roleDefaultPermissions: Record<Role, Permission[]> = {
  admin: [
    "view_admin_dashboard",
    "manage_employees",
    "view_employee_dashboard",
    "manage_gear_requests",
    "manage_venue_ads",
    "view_musician_dashboard",
    "view_customer_dashboard",
  ],
  musician: ["view_musician_dashboard"],
  customer: ["view_customer_dashboard"],
  teacher: [],
  rental_provider: ["view_employee_dashboard", "manage_gear_requests"],
};

export function deriveDefaultPermissions(roles: string[]): Permission[] {
  const perms = new Set<Permission>();
  for (const role of roles as Role[]) {
    for (const p of roleDefaultPermissions[role] ?? []) perms.add(p);
  }
  return Array.from(perms);
}

export function hasRole(roles: string[], required: Role): boolean {
  return roles.includes(required);
}

export function hasAnyRole(roles: string[], required: Role[]): boolean {
  return required.some((r) => roles.includes(r));
}

export function hasPermission(
  perms: string[] | undefined,
  required: Permission
): boolean {
  return (perms ?? []).includes(required);
}
