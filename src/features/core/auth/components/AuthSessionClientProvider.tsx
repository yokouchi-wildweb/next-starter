"use client";

import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";

import type { SessionUser } from "@/features/core/auth/entities/session";
import { fetchSession } from "@/features/core/auth/services/client/session";

import type { AuthSessionValue } from "./AuthSessionContext";
import { AuthSessionContext } from "./AuthSessionContext";

type AuthSessionClientProviderProps = {
  initialUser: SessionUser | null;
  children: ReactNode;
};

export function AuthSessionClientProvider({ initialUser, children }: AuthSessionClientProviderProps) {
  const [user, setUser] = useState<SessionUser | null>(initialUser);

  const refreshSession = useCallback(async () => {
    try {
      const { user: refreshedUser } = await fetchSession();
      setUser(refreshedUser);
    } catch (error) {
      setUser(null);
      throw error;
    }
  }, []);

  const value: AuthSessionValue = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      refreshSession,
    }),
    [user, refreshSession],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}
