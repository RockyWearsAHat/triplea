import React, { createContext, useContext, useEffect, useState } from "react";
import type { Permission, User, UserRole } from "../types";
import { TripleAApiClient } from "../api/client";

interface AuthState {
  user: User | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login(email: string, password: string): Promise<void>;
  register(params: {
    name: string;
    email: string;
    password: string;
    roles?: string[];
  }): Promise<void>;
  logout(): void;
  hasRole(role: UserRole): boolean;
  hasAnyRole(roles: UserRole[]): boolean;
  hasPermission(permission: Permission): boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
  });

  const api = new TripleAApiClient({
    baseUrl: "http://localhost:4000/api",
  });

  useEffect(() => {
    api
      .getCurrentUser()
      .then((remoteUser) => {
        setState({ user: remoteUser, loading: false });
      })
      .catch(() => {
        setState({ user: null, loading: false });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    const user = await api.login(email, password);
    setState({ user, loading: false });
  };

  const register = async (params: {
    name: string;
    email: string;
    password: string;
    roles?: string[];
  }) => {
    const user = await api.register(params);
    setState({ user, loading: false });
  };

  const logout = () => {
    setState({ user: null, loading: false });
    api.logout().catch(() => {
      // ignore network errors on logout
    });
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
    register,
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
