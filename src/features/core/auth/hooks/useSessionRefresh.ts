// src/features/core/auth/hooks/useSessionRefresh.ts

"use client";

import { useCallback, useState } from "react";

import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { createFirebaseSession } from "@/features/core/auth/services/client/firebaseSession";
import { auth } from "@/lib/firebase/client/app";
import { normalizeHttpError } from "@/lib/errors";
import type { HttpError } from "@/lib/errors";

export function useSessionRefresh() {
  const { user, refreshSession } = useAuthSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<HttpError | null>(null);

  const refresh = useCallback(async () => {
    const currentUser = auth.currentUser;

    if (!currentUser || !user) {
      throw new Error("ログイン中のユーザーが見つかりません");
    }

    setIsLoading(true);
    setError(null);

    try {
      // IDトークンを強制リフレッシュ
      const idToken = await currentUser.getIdToken(true);

      // 新しいセッションCookieを発行
      await createFirebaseSession({
        providerType: user.providerType,
        providerUid: currentUser.uid,
        idToken,
      });

      // クライアント状態を更新
      await refreshSession();
    } catch (unknownError) {
      const httpError = normalizeHttpError(unknownError, "セッションのリフレッシュに失敗しました");
      setError(httpError);
      throw httpError;
    } finally {
      setIsLoading(false);
    }
  }, [user, refreshSession]);

  return {
    refresh,
    isLoading,
    error,
  } as const;
}
