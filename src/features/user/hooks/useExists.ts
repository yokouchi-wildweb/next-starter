// src/features/user/hooks/useExists.ts

"use client";

import { useCallback, useState } from "react";
import { userClient } from "../services/client/userClient";
import type { User } from "../entities";
import type { UserProviderType } from "@/types/user";
import { normalizeHttpError, type HttpError } from "@/lib/errors/httpError";

type CheckResult = {
  exists: boolean;
  user: User | null;
};

export const useExists = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<HttpError | null>(null);

  const check = useCallback(
    async (providerType: UserProviderType, uid: string): Promise<CheckResult> => {
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
              { field: "providerType", op: "eq", value: providerType },
              { field: "providerUid", op: "eq", value: uid },
            ],
          },
        });

        const foundUser = results[0] ?? null;

        return {
          exists: Boolean(foundUser),
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
    [],
  );

  return { check, isLoading, error };
};
