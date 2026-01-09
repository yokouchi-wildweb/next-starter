// src/features/core/auth/hooks/useReactivate.ts

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { reactivate as reactivateService } from "@/features/core/auth/services/client/reactivate";
import type { HttpError } from "@/lib/errors";
import { isHttpError } from "@/lib/errors";
import { log } from "@/utils/log";

type UseReactivateOptions = {
  redirectTo?: string;
};

const DEFAULT_REDIRECT_PATH = "/reactivate/complete";

export function useReactivate({
  redirectTo = DEFAULT_REDIRECT_PATH,
}: UseReactivateOptions = {}) {
  const router = useRouter();
  const { refreshSession } = useAuthSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<HttpError | null>(null);

  const handleReactivate = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    log(3, "[useReactivate] starting reactivation");

    try {
      await reactivateService();
      log(3, "[useReactivate] reactivation completed");

      // セッションを更新して最新のステータスを反映
      await refreshSession();
      log(3, "[useReactivate] session refreshed");

      router.replace(redirectTo);
      router.refresh();
    } catch (unknownError) {
      log(3, "[useReactivate] error", { error: unknownError });
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
    reactivate: handleReactivate,
    isLoading,
    error,
  } as const;
}
