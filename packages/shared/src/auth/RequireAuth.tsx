import type { ReactNode } from "react";
import type { Permission, UserRole } from "../types";
import { useAuth } from "./AuthContext";

type RequireBaseProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

export function RequireRole({
  role,
  children,
  fallback,
}: RequireBaseProps & { role: UserRole }) {
  const { hasRole, loading } = useAuth();

  if (loading) return null;
  if (!hasRole(role)) {
    return (
      <>
        {fallback ?? (
          <p style={{ color: "#9ca3af", fontSize: 14 }}>
            You are not authorised to view this area.
          </p>
        )}
      </>
    );
  }

  return <>{children}</>;
}

export function RequireAnyRole({
  roles,
  children,
  fallback,
}: RequireBaseProps & { roles: UserRole[] }) {
  const { hasAnyRole, loading } = useAuth();

  if (loading) return null;
  if (!hasAnyRole(roles)) {
    return (
      <>
        {fallback ?? (
          <p style={{ color: "#9ca3af", fontSize: 14 }}>
            You are not authorised to view this area.
          </p>
        )}
      </>
    );
  }

  return <>{children}</>;
}

export function RequirePermission({
  permission,
  children,
  fallback,
}: RequireBaseProps & { permission: Permission }) {
  const { hasPermission, loading } = useAuth();

  if (loading) return null;
  if (!hasPermission(permission)) {
    return (
      <>
        {fallback ?? (
          <p style={{ color: "#9ca3af", fontSize: 14 }}>
            You are not authorised to perform this action.
          </p>
        )}
      </>
    );
  }

  return <>{children}</>;
}
