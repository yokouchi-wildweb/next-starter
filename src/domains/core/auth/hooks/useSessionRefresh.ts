// src/domains/core/auth/hooks/useSessionRefresh.ts

"use client";

import { useCallback, useState } from "react";

import { useAuthSession } from "@/domains/core/auth/hooks/useAuthSession";
import { fetchSession } from "@/domains/core/auth/services/client/session";
import { normalizeHttpError } from "@/lib/errors";
import type { HttpError } from "@/lib/errors";

export function useSessionRefresh() {
  const { refreshSession } = useAuthSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<HttpError | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // セッションAPIを呼び出して新しいトークンを発行
      await fetchSession();

      // クライアント状態を更新
      await refreshSession();
    } catch (unknownError) {
      const httpError = normalizeHttpError(unknownError, "セッションのリフレッシュに失敗しました");
      setError(httpError);
      throw httpError;
    } finally {
      setIsLoading(false);
    }
  }, [refreshSession]);

  return {
    refresh,
    isLoading,
    error,
  } as const;
}
