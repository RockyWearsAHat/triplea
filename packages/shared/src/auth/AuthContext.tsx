import React, { createContext, useContext, useEffect, useState } from "react";
import type { Permission, User, UserRole } from "../types";
import { TripleAApiClient } from "../api/client";

interface AuthState {
  user: User | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login(email: string, password: string): Promise<void>;
  // Temporary helper for demo flows while real login is wired through all UIs.
  loginAs(role: UserRole): void;
  logout(): void;
  hasRole(role: UserRole): boolean;
  hasAnyRole(roles: UserRole[]): boolean;
  hasPermission(permission: Permission): boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "tripleA.currentUser";

function getInitialUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
  });

  const api = new TripleAApiClient({
    baseUrl: "http://localhost:4000/api",
  });

  useEffect(() => {
    const user = getInitialUser();
    setState({ user, loading: true });

    api
      .getCurrentUser()
      .then((remoteUser) => {
        setState({ user: remoteUser ?? user, loading: false });
        if (remoteUser) {
          try {
            window.localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify(remoteUser)
            );
          } catch {
            // ignore storage errors
          }
        }
      })
      .catch(() => {
        setState({ user, loading: false });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rolePermissions: Record<UserRole, Permission[]> = {
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
    customer: ["view_customer_dashboard", "manage_venue_ads"],
    teacher: [],
    rental_provider: ["view_employee_dashboard", "manage_gear_requests"],
  };

  const loginAs = (role: UserRole) => {
    const user: User = {
      id: "demo",
      name:
        role === "musician"
          ? "Demo Musician"
          : role === "customer"
          ? "Demo Customer"
          : role === "admin"
          ? "Demo Admin"
          : "Demo User",
      email: "demo@example.com",
      role: [role],
      permissions: rolePermissions[role] ?? [],
    };
    setState({ user, loading: false });
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } catch {
      // ignore storage errors
    }
  };

  const login = async (email: string, password: string) => {
    const user = await api.login(email, password);
    setState({ user, loading: false });
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } catch {
      // ignore storage errors
    }
  };

  const logout = () => {
    setState({ user: null, loading: false });
    api.logout().catch(() => {
      // ignore network errors on logout
    });
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  };

  const hasRole = (role: UserRole): boolean => {
    return !!state.user?.role.includes(role);
  };

  const hasAnyRole = (roles: UserRole[]): boolean => {
    if (!state.user) return false;
    return roles.some((r) => state.user!.role.includes(r));
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!state.user?.permissions) return false;
    return state.user.permissions.includes(permission);
  };

  const value: AuthContextValue = {
    ...state,
    login,
    loginAs,
    logout,
    hasRole,
    hasAnyRole,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
