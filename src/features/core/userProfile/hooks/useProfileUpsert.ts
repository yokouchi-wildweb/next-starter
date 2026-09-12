"use client";

import { useDomainMutation } from "@/lib/crud/hooks";
import { profileClient } from "../services/client/profileClient";

/**
 * プロフィールをupsertするフック
 * 並列 trigger 安全（lib/crud/hooks/internal/useDomainMutation に準拠）
 * @param role - ロールID（例: "contributor"）
 */
export const useProfileUpsert = (role: string) => {
  const mutation = useDomainMutation<Record<string, unknown>, Record<string, unknown>>(
    `profile:${role}/upsert`,
    (data) => profileClient.upsert(role, data),
    `profile:${role}/search`,
  );

  return {
    trigger: mutation.trigger,
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
  };
};
