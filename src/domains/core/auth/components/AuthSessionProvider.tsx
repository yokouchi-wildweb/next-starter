// src/domains/auth/components/AuthSessionProvider.tsx

import type { ReactNode } from "react";
import { cookies } from "next/headers";

import { parseSessionCookie } from "@/lib/jwt";
import type { SessionUser } from "@/domains/core/auth/entities/session";
import { resolveSessionUser } from "@/domains/core/auth/services/server/session/token";

import { AuthSessionClientProvider } from "./AuthSessionClientProvider";

type AuthSessionProviderProps = {
  children: ReactNode;
};

/** リクエストの Cookie からセッションの利用者を解く。トークンが無い・解決できなければ null(未ログイン) */
async function readSessionUser(): Promise<SessionUser | null> {
  const token = parseSessionCookie(await cookies());
  if (!token) return null;
  return (await resolveSessionUser(token)) ?? null;
}

export function AuthSessionProvider({ children }: AuthSessionProviderProps) {
  // セッションは await せず promise のまま渡す(読み手が use で読む)。Provider と children は
  // セッションを待たないので、セッションを読まない部分はリクエストを待たずに描ける。
  return <AuthSessionClientProvider userPromise={readSessionUser()}>{children}</AuthSessionClientProvider>;
}
