// src/domains/auth/components/AuthSessionProvider.tsx

import type { ReactNode } from "react";

import { getSessionUser } from "@/domains/core/auth/services/server/session/getSessionUser";

import { AuthSessionClientProvider } from "./AuthSessionClientProvider";

type AuthSessionProviderProps = {
  children: ReactNode;
};

export function AuthSessionProvider({ children }: AuthSessionProviderProps) {
  // セッションは await せず promise のまま渡す(読み手が use で読む)。Provider と children は
  // セッションを待たないので、セッションを読まない部分はリクエストを待たずに描ける。
  // 読みは getSessionUser(要求の中で 1 回の引きを守りと共有、印がある時は request の時だけ確かめる)
  return <AuthSessionClientProvider userPromise={getSessionUser()}>{children}</AuthSessionClientProvider>;
}
