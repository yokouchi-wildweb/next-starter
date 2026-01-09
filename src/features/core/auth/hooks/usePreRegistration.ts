// src/features/auth/hooks/usePreRegistration.ts

"use client";

import { useCallback, useState } from "react";

import { preRegister as preRegisterService } from "@/features/core/auth/services/client/preRegistration";
import type { User } from "@/features/core/user/entities";
import type { UserProviderType } from "@/features/core/user/types";
import { isHttpError, type HttpError } from "@/lib/errors";

export type PreRegistrationInput = {
  providerType: UserProviderType;
  providerUid: string;
  idToken: string;
  email?: string;
};

export type PreRegistrationResult = {
  user: User;
  session: {
    expiresAt: string;
  };
};

export function usePreRegistration() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<HttpError | null>(null);

  const preRegister = useCallback(
    async (payload: PreRegistrationInput): Promise<PreRegistrationResult> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await preRegisterService(payload);
        return result;
      } catch (unknownError) {
        if (isHttpError(unknownError)) {
          setError(unknownError);
        } else {
          setError(null);
        }
        throw unknownError;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return {
    preRegister,
    isLoading,
    error,
  } as const;
}
