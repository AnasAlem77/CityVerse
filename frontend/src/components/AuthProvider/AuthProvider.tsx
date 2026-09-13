"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  ready: boolean;
  signIn: (token: string, user: AuthUser) => void;
  signOut: () => void;
  updateUser: (user: AuthUser) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function clearStoredAuth() {
  localStorage.removeItem("cityverse_token");
  localStorage.removeItem("cityverse_user");
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("cityverse_user");
      setUser(storedUser ? JSON.parse(storedUser) as AuthUser : null);
    } catch {
      clearStoredAuth();
      setUser(null);
    } finally {
      setReady(true);
    }

    const syncOtherTabs = (event: StorageEvent) => {
      if (event.key !== "cityverse_user" && event.key !== null) return;
      try {
        setUser(event.newValue ? JSON.parse(event.newValue) as AuthUser : null);
      } catch {
        setUser(null);
      }
    };

    window.addEventListener("storage", syncOtherTabs);
    return () => window.removeEventListener("storage", syncOtherTabs);
  }, []);

  const signIn = useCallback((token: string, nextUser: AuthUser) => {
    localStorage.setItem("cityverse_token", token);
    localStorage.setItem("cityverse_user", JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  const signOut = useCallback(() => {
    clearStoredAuth();
    setUser(null);
  }, []);
  const updateUser = useCallback((nextUser: AuthUser) => {
    localStorage.setItem("cityverse_user", JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  const value = useMemo(() => ({ user, ready, signIn, signOut, updateUser }), [user, ready, signIn, signOut, updateUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
