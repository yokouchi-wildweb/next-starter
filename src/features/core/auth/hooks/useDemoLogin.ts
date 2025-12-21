// src/features/core/auth/hooks/useDemoLogin.ts

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { demoLogin as demoLoginService } from "@/features/core/auth/services/client/demoLogin";
import type { HttpError } from "@/lib/errors";
import { isHttpError } from "@/lib/errors";

type UseDemoLoginOptions = {
  redirectTo?: string;
};

const DEFAULT_REDIRECT_PATH = "/";

export function useDemoLogin({ redirectTo = DEFAULT_REDIRECT_PATH }: UseDemoLoginOptions = {}) {
  const router = useRouter();
  const { refreshSession } = useAuthSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<HttpError | null>(null);

  const handleDemoLogin = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await demoLoginService();
      await refreshSession();

      router.replace(redirectTo);
      router.refresh();
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
  }, [redirectTo, refreshSession, router]);

  return {
    demoLogin: handleDemoLogin,
    isLoading,
    error,
  } as const;
}
