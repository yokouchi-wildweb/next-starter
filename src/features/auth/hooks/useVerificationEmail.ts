// src/features/auth/hooks/useVerificationEmail.ts

"use client";

// Firebase Auth のメールリンク送信を管理するカスタムフックです。
// UI からはこのフックを介してメール送信処理を呼び出し、状態とエラーを参照します。

import { useCallback, useState } from "react";

import type { ActionCodeSettings } from "firebase/auth";
import { sendVerificationEmail as sendVerificationEmailClient } from "@/lib/firebase/client/sendVerificationEmail";
import type { HttpError } from "@/lib/errors";

export function useVerificationEmail() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<HttpError | null>(null);

  const handleSend = useCallback(
    async (email: string, actionCodeSettings: ActionCodeSettings) => {
      setIsLoading(true);
      setError(null);

      try {
        await sendVerificationEmailClient(email, actionCodeSettings);
      } catch (err: unknown) {
        const httpError = err as HttpError;

        setError(httpError);
        throw httpError;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return {
    sendVerificationEmail: handleSend,
    isLoading,
    error,
  } as const;
}
