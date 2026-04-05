// src/features/core/auth/hooks/useEmailChange.ts

"use client";

import { useState, useCallback, useRef } from "react";
import { userClient, type SendEmailChangeVerificationInput } from "@/features/core/user/services/client/userClient";
import { normalizeHttpError } from "@/lib/errors";

type UseEmailChangeReturn = {
  sendVerification: (data: SendEmailChangeVerificationInput) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
  isSuccess: boolean;
  reset: () => void;
};

export function useEmailChange(): UseEmailChangeReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const lockRef = useRef(false);

  const reset = useCallback(() => {
    setError(null);
    setIsSuccess(false);
  }, []);

  const sendVerification = useCallback(async (data: SendEmailChangeVerificationInput): Promise<boolean> => {
    if (lockRef.current) return false;
    lockRef.current = true;
    setIsLoading(true);
    setError(null);
    setIsSuccess(false);

    try {
      await userClient.sendEmailChangeVerification(data);
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
    sendVerification,
    isLoading,
    error,
    isSuccess,
    reset,
  };
}
