// src/features/core/auth/hooks/useWithdraw.ts

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { withdraw as withdrawService } from "@/features/core/auth/services/client/withdraw";
import type { HttpError } from "@/lib/errors";
import { isHttpError } from "@/lib/errors";

type UseWithdrawOptions = {
  redirectTo?: string;
};

const DEFAULT_REDIRECT_PATH = "/";

export function useWithdraw({
  redirectTo = DEFAULT_REDIRECT_PATH,
}: UseWithdrawOptions = {}) {
  const router = useRouter();
  const { refreshSession } = useAuthSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<HttpError | null>(null);

  const handleWithdraw = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await withdrawService();

      try {
        await refreshSession();
      } catch {
        // refreshSession は退会後に 401 を受け取る可能性がある。
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
    withdraw: handleWithdraw,
    isLoading,
    error,
  } as const;
}
