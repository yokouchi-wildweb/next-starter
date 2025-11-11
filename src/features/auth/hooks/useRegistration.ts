// src/features/auth/hooks/useRegistration.ts

"use client";

import { useCallback, useState } from "react";
import type { z } from "zod";

import { RegistrationSchema } from "@/features/auth/entities";
import { register as registerService } from "@/features/auth/services/client/registration";
import type { User } from "@/features/user/entities";
import { isHttpError, type HttpError } from "@/lib/errors";

export type RegistrationInput = z.infer<typeof RegistrationSchema>;
export type RegistrationResult = {
  user: User;
  session: {
    expiresAt: string;
  };
};

export function useRegistration() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<HttpError | null>(null);

  const register = useCallback(
    async (payload: RegistrationInput): Promise<RegistrationResult> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await registerService(payload);
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
    register,
    isLoading,
    error,
  } as const;
}

