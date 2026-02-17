// src/features/core/auth/hooks/useAdminLogin.ts

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";

import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { localLogin } from "@/features/core/auth/services/client/localLogin";
import { auth } from "@/lib/firebase/client/app";
import { err } from "@/lib/errors";

type AdminLoginParams = {
  email: string;
  password: string;
};

export function useAdminLogin() {
  const router = useRouter();
  const { refreshSession } = useAuthSession();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const signIn = useCallback(
    async ({ email, password }: AdminLoginParams) => {
      if (isLoading) return;

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const result = await localLogin({ email, password });

        // Firebase Storage のセキュリティルールを通すため、Firebase Auth にもサインインする。
        await signInWithCustomToken(auth, result.firebaseCustomToken);

        await refreshSession();

        if (result.requiresReactivation) {
          router.push("/reactivate");
        } else {
          router.push("/admin");
        }
      } catch (error) {
        setErrorMessage(err(error, "ログインに失敗しました"));
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, refreshSession, router],
  );

  return {
    signIn,
    isLoading,
    errorMessage,
  } as const;
}
