// src/features/core/auth/hooks/useDemoLogin.ts

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { demoLogin as demoLoginService } from "@/features/core/auth/services/client/demoLogin";
import { DEMO_USER_ID_KEY } from "@/features/core/auth/constants/localStorage";
import {
  loadFromLocalStorage,
  saveToLocalStorage,
} from "@/lib/localStorage/clientService";
import type { HttpError } from "@/lib/errors";
import { isHttpError } from "@/lib/errors";

type UseDemoLoginOptions = {
  redirectTo?: string;
};

const DEFAULT_REDIRECT_PATH = "/";

/**
 * ローカルストレージからデモユーザーIDを取得する。
 * 取得に失敗した場合は null を返す。
 */
function getDemoUserIdFromStorage(): string | null {
  try {
    return loadFromLocalStorage(DEMO_USER_ID_KEY);
  } catch {
    return null;
  }
}

/**
 * ローカルストレージにデモユーザーIDを保存する。
 * 保存に失敗した場合は無視する。
 */
function saveDemoUserIdToStorage(demoUserId: string): void {
  try {
    saveToLocalStorage(DEMO_USER_ID_KEY, demoUserId);
  } catch {
    // 保存に失敗しても処理は続行
  }
}

export function useDemoLogin({ redirectTo = DEFAULT_REDIRECT_PATH }: UseDemoLoginOptions = {}) {
  const router = useRouter();
  const { refreshSession } = useAuthSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<HttpError | null>(null);

  const handleDemoLogin = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // ローカルストレージから既存のデモユーザーIDを取得
      const existingDemoUserId = getDemoUserIdFromStorage();

      // デモログイン実行
      const result = await demoLoginService({ demoUserId: existingDemoUserId });

      // レスポンスのデモユーザーIDをローカルストレージに保存
      saveDemoUserIdToStorage(result.demoUserId);

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
