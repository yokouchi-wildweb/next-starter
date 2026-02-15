"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type { HttpError } from "@/lib/errors";
import { revalidateRelatedCaches } from "./revalidateRelatedCaches";

/**
 * ID 配列での複数削除用フック
 */
export function useBulkDeleteByIdsDomain(
  key: string,
  bulkDeleteByIdsFn: (ids: string[]) => Promise<void>,
  revalidateKey?: string | string[],
) {
  const { mutate } = useSWRConfig();

  const mutation = useSWRMutation<void, HttpError, string, string[]>(
    key,
    (_key, { arg }) => bulkDeleteByIdsFn(arg),
    {
      onSuccess: async () => {
        if (revalidateKey) {
          await revalidateRelatedCaches(mutate, revalidateKey);
        }
      },
    },
  );

  return {
    trigger: (ids: string[]) =>
      (mutation.trigger as (ids: string[]) => Promise<void>)(ids),
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
  };
}
