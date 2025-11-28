// src/features/user/hooks/useEmailUserExists.ts

"use client";

import { useCallback, useState } from "react";
import { normalizeHttpError, type HttpError } from "@/lib/errors/httpError";
import type { UserProviderType } from "@/types/user";
import type { User } from "../entities";
import { userClient } from "../services/client/userClient";
import { useStatusChecker } from "./useStatusChecker";

const EMAIL_PROVIDER: UserProviderType = "email";

type CheckResult = {
  exists: boolean;
  user: User | null;
};

export const useEmailUserExists = () => {
  const { isRegistered } = useStatusChecker();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<HttpError | null>(null);
  const check = useCallback(
    async (email: string): Promise<CheckResult> => {
      setIsLoading(true);
      setError(null);

      try {
        if (!userClient.search) {
          throw new Error("ユーザー検索機能が利用できません");
        }

        const { results } = await userClient.search({
          limit: 1,
          where: {
            and: [
              { field: "providerType", op: "eq", value: EMAIL_PROVIDER },
              { field: "email", op: "eq", value: email },
            ],
          },
        });

        const foundUser = results[0] ?? null;

        const exists = isRegistered(foundUser);

        return {
          exists,
          user: foundUser,
        };
      } catch (caughtError) {
        const normalizedError = normalizeHttpError(caughtError);
        setError(normalizedError);
        throw normalizedError;
      } finally {
        setIsLoading(false);
      }
    },
    [isRegistered],
  );

  return { check, isLoading, error };
};
