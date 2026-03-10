"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type { HttpError } from "@/lib/errors";
import { revalidateRelatedCaches } from "@/lib/crud/hooks/revalidateRelatedCaches";
import { profileClient } from "../services/client/profileClient";

/**
 * プロフィールをupsertするフック
 * @param role - ロールID（例: "contributor"）
 */
export const useProfileUpsert = (role: string) => {
  const { mutate } = useSWRConfig();
  const revalidateKey = `profile:${role}/search`;

  const mutation = useSWRMutation<
    Record<string, unknown>,
    HttpError,
    string,
    Record<string, unknown>
  >(
    `profile:${role}/upsert`,
    (_key, { arg }) => profileClient.upsert(role, arg),
    {
      onSuccess: async () => {
        await revalidateRelatedCaches(mutate, revalidateKey);
      },
    },
  );

  return {
    trigger: (data: Record<string, unknown>) =>
      (mutation.trigger as (arg: Record<string, unknown>) => Promise<Record<string, unknown>>)(data),
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
  };
};
