// src/features/core/user/hooks/useUpdateMyProfile.ts

"use client";

import { useState, useCallback } from "react";
import { userClient, type UpdateMyProfileInput } from "../services/client/userClient";
import { normalizeHttpError } from "@/lib/errors";
import type { User } from "../entities";

type UseUpdateMyProfileReturn = {
  updateProfile: (data: UpdateMyProfileInput) => Promise<User | null>;
  isLoading: boolean;
  error: string | null;
  reset: () => void;
};

export function useUpdateMyProfile(): UseUpdateMyProfileReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  const updateProfile = useCallback(async (data: UpdateMyProfileInput): Promise<User | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await userClient.updateMyProfile(data);
      return result;
    } catch (err) {
      const normalized = normalizeHttpError(err);
      setError(normalized.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    updateProfile,
    isLoading,
    error,
    reset,
  };
}
