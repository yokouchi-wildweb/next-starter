// src/features/user/hooks/useEmailUserExists.ts

"use client";

import { useCallback, useState } from "react";
import { normalizeHttpError, type HttpError } from "@/lib/errors/httpError";
import { userClient } from "../services/client/userClient";

type CheckResult = {
  exists: boolean;
};

export const useEmailUserExists = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<HttpError | null>(null);
  const check = useCallback(
    async (email: string): Promise<CheckResult> => {
      setIsLoading(true);
      setError(null);

      try {
        // 未認証で叩く公開エンドポイント。PII を返さず exists のみ判定する
        // （汎用 /api/user/search は admin 限定のため未認証サインアップでは使えない）。
        const { exists } = await userClient.checkEmailRegistered(email);
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
