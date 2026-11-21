"use client";

import { use, useContext, useMemo } from "react";

import { AuthSessionContext, type AuthSessionValue } from "@/features/core/auth/components/AuthSessionContext";

/**
 * 認証 Context からユーザー情報と補助フラグ／操作を取得する。
 * refreshSession が決めた値(override)があればそれを、無ければサーバーが渡したセッションの promise を use で読む
 * (解けるまでの間は一番近い Suspense で待つ)。user が null = 未ログイン。
 */
export function useAuthSession(): AuthSessionValue {
  const { userPromise, override, refreshSession } = useContext(AuthSessionContext);
  const user = override ? override.user : use(userPromise);
  return useMemo(() => ({ user, isAuthenticated: user !== null, refreshSession }), [user, refreshSession]);
}
