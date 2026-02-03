// src/features/auth/hooks/useVerificationEmail.ts

"use client";

// メールリンク送信を管理するカスタムフックです。
// UI からはこのフックを介してメール送信処理を呼び出し、状態とエラーを参照します。

import { useCallback, useState } from "react";

import { sendEmailLink } from "@/features/core/auth/services/client/sendEmailLink";
import type { HttpError } from "@/lib/errors";

export type SendVerificationEmailOptions = {
  /** reCAPTCHA v3 トークン */
  recaptchaToken?: string;
};

export function useVerificationEmail() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<HttpError | null>(null);

  const handleSend = useCallback(async (email: string, options?: SendVerificationEmailOptions) => {
    setIsLoading(true);
    setError(null);

    try {
      await sendEmailLink({ email }, { recaptchaToken: options?.recaptchaToken });
    } catch (err: unknown) {
      const httpError = err as HttpError;

      setError(httpError);
      throw httpError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    sendVerificationEmail: handleSend,
    isLoading,
    error,
  } as const;
}
