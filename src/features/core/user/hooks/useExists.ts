// src/features/user/hooks/useExists.ts

"use client";

import { useCallback, useState } from "react";
import { userClient } from "../services/client/userClient";
import type { UserProviderType } from "@/features/core/user/types";
import { normalizeHttpError, type HttpError } from "@/lib/errors/httpError";

type CheckResult = {
  /** 登録済みユーザーが存在するか（status が登録済みのもののみ true） */
  exists: boolean;
};

export const useExists = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<HttpError | null>(null);

  const check = useCallback(
    async (providerType: UserProviderType, uid: string): Promise<CheckResult> => {
      setIsLoading(true);
      setError(null);

      try {
        // 未認証で叩く公開エンドポイント。PII を返さず exists のみ判定する
        // （汎用 /api/user/search は admin 限定のため未認証 OAuth ログインでは使えない）。
        const { exists } = await userClient.checkAccountRegistered(providerType, uid);
        return { exists };
      } catch (caughtError) {
        const normalizedError = normalizeHttpError(caughtError);
        setError(normalizedError);
        throw normalizedError;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return { check, isLoading, error };
};
