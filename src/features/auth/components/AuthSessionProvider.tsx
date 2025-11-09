// src/features/auth/components/AuthSessionProvider.tsx

import type { ReactNode } from "react";
import { cookies } from "next/headers";

import { parseSessionCookie } from "@/lib/jwt";
import { resolveSessionUser } from "@/features/auth/services/server/session/token";

import { AuthSessionClientProvider } from "./AuthSessionClientProvider";

type AuthSessionProviderProps = {
  children: ReactNode;
};

export async function AuthSessionProvider({ children }: AuthSessionProviderProps) {
  // リクエストに紐づく Cookie ストアを取得し、サーバー側でセッショントークンを解析する。
  const cookieStore = await cookies();
  const token = parseSessionCookie(cookieStore);

  if (!token) {
    // トークンが存在しない場合は未ログイン扱いとして、ユーザー情報なしでコンテキストを初期化する。
    return <AuthSessionClientProvider initialUser={null}>{children}</AuthSessionClientProvider>;
  }

  // 有効なトークンであればユーザー情報へ正規化し、失敗した場合は未ログイン扱いとする。
  const sessionUser = await resolveSessionUser(token);

  if (!sessionUser) {
    return <AuthSessionClientProvider initialUser={null}>{children}</AuthSessionClientProvider>;
  }

  // 認証済みユーザーを初期値としてクライアント側プロバイダーに委譲する。
  return <AuthSessionClientProvider initialUser={sessionUser}>{children}</AuthSessionClientProvider>;
}
