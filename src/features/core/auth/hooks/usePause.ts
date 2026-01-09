// src/features/core/auth/hooks/usePause.ts

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { pause as pauseService } from "@/features/core/auth/services/client/pause";
import type { HttpError } from "@/lib/errors";
import { isHttpError } from "@/lib/errors";

type UsePauseOptions = {
  redirectTo?: string;
};

const DEFAULT_REDIRECT_PATH = "/";

export function usePause({
  redirectTo = DEFAULT_REDIRECT_PATH,
}: UsePauseOptions = {}) {
  const router = useRouter();
  const { refreshSession } = useAuthSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<HttpError | null>(null);

  const handlePause = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await pauseService();

      try {
        await refreshSession();
      } catch {
        // refreshSession は休会後に 401 を受け取る可能性がある。
        // その際にも Context 内のユーザー情報は null へ更新されるため握り潰す。
      }

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
    pause: handlePause,
    isLoading,
    error,
  } as const;
}
