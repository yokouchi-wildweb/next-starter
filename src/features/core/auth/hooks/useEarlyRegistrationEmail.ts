// src/features/core/auth/hooks/useEarlyRegistrationEmail.ts

"use client";

// 事前登録用メールリンク送信を管理するカスタムフックです。
// UI からはこのフックを介してメール送信処理を呼び出し、状態とエラーを参照します。

import { useCallback, useState } from "react";

import { sendEarlyRegistrationLink } from "@/features/core/auth/services/client/sendEarlyRegistrationLink";
import type { HttpError } from "@/lib/errors";

export function useEarlyRegistrationEmail() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<HttpError | null>(null);

  const handleSend = useCallback(async (email: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await sendEarlyRegistrationLink({ email });
    } catch (err: unknown) {
      const httpError = err as HttpError;

      setError(httpError);
      throw httpError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    sendEarlyRegistrationEmail: handleSend,
    isLoading,
    error,
  } as const;
}
