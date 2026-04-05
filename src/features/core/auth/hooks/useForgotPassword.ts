// src/features/core/auth/hooks/useForgotPassword.ts

"use client";

import { useState, useCallback, useRef } from "react";
import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

type UseForgotPasswordReturn = {
  sendResetEmail: (email: string) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
  isSuccess: boolean;
  reset: () => void;
};

/**
 * パスワードリセットメールを送信するフック
 */
export function useForgotPassword(): UseForgotPasswordReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const lockRef = useRef(false);

  const reset = useCallback(() => {
    setError(null);
    setIsSuccess(false);
  }, []);

  const sendResetEmail = useCallback(async (email: string): Promise<boolean> => {
    if (lockRef.current) return false;
    lockRef.current = true;
    setIsLoading(true);
    setError(null);
    setIsSuccess(false);

    try {
      await axios.post("/api/auth/forgot-password", { email });
      setIsSuccess(true);
      return true;
    } catch (err) {
      const normalized = normalizeHttpError(err);
      setError(normalized.message);
      return false;
    } finally {
      lockRef.current = false;
      setIsLoading(false);
    }
  }, []);

  return {
    sendResetEmail,
    isLoading,
    error,
    isSuccess,
    reset,
  };
}
