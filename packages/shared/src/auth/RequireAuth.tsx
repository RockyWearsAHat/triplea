import type { ReactNode } from "react";
import type { Permission, UserRole } from "../types";
import { useAuth } from "./AuthContext";

type RequireBaseProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

/**
 * AuthGuard - Use this hook in pages that need auth verification before rendering.
 * Returns { isReady, isAuthenticated, user } - wait for isReady before making decisions.
 */
export function useAuthGuard() {
  const { user, loading } = useAuth();
  return {
    isReady: !loading,
    isAuthenticated: !!user,
    user,
  };
}

/**
 * AuthLoadingScreen - Minimal loading indicator shown while verifying auth.
 * Designed to be non-intrusive and not flash content.
 */
export function AuthLoadingScreen() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "200px",
        color: "var(--text-muted)",
        fontSize: 14,
      }}
    >
      <span>Verifying session…</span>
    </div>
  );
}

export function RequireAuth({ children, fallback }: RequireBaseProps) {
  const { user, loading } = useAuth();

  if (loading) return <AuthLoadingScreen />;
  if (!user) {
    return (
      <>
        {fallback ?? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            Please sign in to continue.
          </p>
        )}
      </>
    );
  }

  return <>{children}</>;
}

export function RequireRole({
  role,
  children,
  fallback,
}: RequireBaseProps & { role: UserRole }) {
  const { hasRole, loading } = useAuth();

  if (loading) return <AuthLoadingScreen />;
  if (!hasRole(role)) {
    return (
      <>
        {fallback ?? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
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

  if (loading) return <AuthLoadingScreen />;
  if (!hasAnyRole(roles)) {
    return (
      <>
        {fallback ?? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
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

  if (loading) return <AuthLoadingScreen />;
  if (!hasPermission(permission)) {
    return (
      <>
        {fallback ?? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            You are not authorised to perform this action.
          </p>
        )}
      </>
    );
  }

  return <>{children}</>;
}
