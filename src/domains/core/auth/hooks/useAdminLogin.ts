// src/domains/core/auth/hooks/useAdminLogin.ts

"use client";

import { useCallback, useRef, useState } from "react";
import { signInWithCustomToken } from "firebase/auth";

import { useAuthSession } from "@/domains/core/auth/hooks/useAuthSession";
import { localLogin } from "@/domains/core/auth/services/client/localLogin";
import { auth, isFirebaseClientConfigured } from "@/lib/firebase/client";
import { err } from "@/lib/errors";
import { reloadTo } from "@/lib/url";

type AdminLoginParams = {
  email: string;
  password: string;
  /** ログイン成功後の遷移先。未指定時は /admin */
  redirectTo?: string;
};

const DEFAULT_REDIRECT_PATH = "/admin";

export function useAdminLogin() {
  const { refreshSession } = useAuthSession();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const lockRef = useRef(false);

  const signIn = useCallback(
    async ({ email, password, redirectTo }: AdminLoginParams) => {
      if (lockRef.current) return;
      lockRef.current = true;

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const result = await localLogin({ email, password });

        await refreshSession();

        // Firebase Storage のセキュリティルールを通すため、Firebase Auth にもサインインする。
        // 管理者ログインに必須ではないため、失敗してもログインフローは中断しない。
        // 失敗時は useFirebaseAuthSync が自動的に再試行する。
        // Firebase が未設定(サーバーがトークンを出さない・クライアントの env が空)なら auth に触れない
        if (result.firebaseCustomToken && isFirebaseClientConfigured()) {
          try {
            // 読み直しの前に済ませる(読み直しで途中の sign-in が切れないように)
            await signInWithCustomToken(auth, result.firebaseCustomToken).catch(() => {});
          } catch {
            // 呼んだ時点で投げることがある(.catch の前)。ログインは続ける
          }
        }

        // 利用者が替わる: ページの読み直し(D139)
        reloadTo(result.requiresReactivation ? "/reactivate" : (redirectTo ?? DEFAULT_REDIRECT_PATH));
      } catch (error) {
        setErrorMessage(err(error, "ログインに失敗しました"));
      } finally {
        lockRef.current = false;
        setIsLoading(false);
      }
    },
    [refreshSession],
  );

  return {
    signIn,
    isLoading,
    errorMessage,
  } as const;
}
