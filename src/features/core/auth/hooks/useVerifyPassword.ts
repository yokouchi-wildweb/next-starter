// src/features/core/auth/hooks/useVerifyPassword.ts

"use client";

import { useState, useCallback } from "react";

import {
  verifyPassword,
  type VerifyPasswordPayload,
} from "../services/client/verifyPassword";

/**
 * パスワード検証を実行するフック
 */
export function useVerifyPassword() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const verify = useCallback(
    async (payload: VerifyPasswordPayload): Promise<boolean> => {
      setIsVerifying(true);
      setError(null);

      try {
        const isValid = await verifyPassword(payload);
        return isValid;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("パスワード検証に失敗しました");
        setError(error);
        throw error;
      } finally {
        setIsVerifying(false);
      }
    },
    []
  );

  return {
    verify,
    isVerifying,
    error,
  };
}
