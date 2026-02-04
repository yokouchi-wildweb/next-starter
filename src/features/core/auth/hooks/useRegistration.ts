// src/features/auth/hooks/useRegistration.ts

"use client";

import { useCallback, useState } from "react";
import type { z } from "zod";

import { RegistrationSchema } from "@/features/core/auth/entities";
import { register as registerService } from "@/features/core/auth/services/client/registration";
import type { User } from "@/features/core/user/entities";
import { isHttpError, type HttpError } from "@/lib/errors";

export type RegistrationInput = z.infer<typeof RegistrationSchema>;

export type RegistrationOptions = {
  /** reCAPTCHA v3 トークン */
  recaptchaToken?: string;
  /** reCAPTCHA v2 トークン（v2チャレンジ完了後のリトライ時） */
  recaptchaV2Token?: string;
};

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
    async (payload: RegistrationInput, options?: RegistrationOptions): Promise<RegistrationResult> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await registerService(payload, {
          recaptchaToken: options?.recaptchaToken,
          recaptchaV2Token: options?.recaptchaV2Token,
        });
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

