"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type { HttpError } from "@/lib/errors";
import { revalidateRelatedCaches } from "./revalidateRelatedCaches";

/**
 * ドメインデータを完全削除（物理削除）するためのフック
 */
export function useHardDeleteDomain(
  key: string,
  hardDeleteFn: (id: string) => Promise<void>,
  revalidateKey?: string | string[],
) {
  const { mutate } = useSWRConfig();

  const mutation = useSWRMutation<void, HttpError, string, string>(
    key,
    (_key, { arg }) => hardDeleteFn(arg),
    {
      onSuccess: async () => {
        if (revalidateKey) {
          await revalidateRelatedCaches(mutate, revalidateKey);
        }
      },
    },
  );

  return {
    trigger: (id: string) => (mutation.trigger as (id: string) => Promise<void>)(id),
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
  };
}
