// src/features/user/hooks/useCreateDemoUser.ts

"use client";

import { useState, useCallback } from "react";

import type { User } from "../entities";
import type { CreateDemoUserInput } from "../services/types";
import { createDemoUser } from "../services/client/createDemoUser";

type UseCreateDemoUserResult = {
  trigger: (data: CreateDemoUserInput) => Promise<User>;
  isMutating: boolean;
  error: Error | null;
};

export function useCreateDemoUser(): UseCreateDemoUserResult {
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const trigger = useCallback(async (data: CreateDemoUserInput): Promise<User> => {
    setIsMutating(true);
    setError(null);

    try {
      const user = await createDemoUser(data);
      return user;
    } catch (err) {
      const normalizedError = err instanceof Error ? err : new Error("デモユーザーの作成に失敗しました");
      setError(normalizedError);
      throw normalizedError;
    } finally {
      setIsMutating(false);
    }
  }, []);

  return { trigger, isMutating, error };
}
