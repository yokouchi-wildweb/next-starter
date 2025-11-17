"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type { HttpError } from "@/lib/errors";

/**
 * 複数削除用のフック
 */
export function useBulkDeleteDomain(
  key: string,
  bulkDeleteFn: (ids: string[]) => Promise<void>,
  revalidateKey?: string | string[],
) {
  const { mutate } = useSWRConfig();

  const mutation = useSWRMutation<void, HttpError, string, string[]>(
    key,
    (_key, { arg }) => bulkDeleteFn(arg),
    {
      onSuccess: async () => {
        if (revalidateKey) {
          await mutate(revalidateKey);
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
