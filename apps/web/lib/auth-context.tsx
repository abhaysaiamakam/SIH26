"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as api from "./api-client";
import { getToken, setToken } from "./api-client";
import type { AuthUser } from "./types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_STORAGE_KEY = "railopt.user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(USER_STORAGE_KEY);
      if (raw && getToken()) setUser(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { accessToken, user: loggedInUser } = await api.login(email, password);
      setToken(accessToken);
      window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(loggedInUser));
      setUser(loggedInUser);
    } catch (err) {
      setError(err instanceof api.ApiError ? err.message : "Login failed");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    window.localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (...roles: string[]) => !!user && ((user.roles as string[]).includes("ADMIN") || roles.some((r) => (user.roles as string[]).includes(r))),
    [user],
  );

  return <AuthContext.Provider value={{ user, loading, error, login, logout, hasRole }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
