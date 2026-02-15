"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type { HttpError } from "@/lib/errors";
import { revalidateRelatedCaches } from "./revalidateRelatedCaches";

/**
 * ドメインデータを複製するためのフック
 */
export function useDuplicateDomain<T>(
  key: string,
  duplicateFn: (id: string) => Promise<T>,
  revalidateKey?: string | string[],
) {
  const { mutate } = useSWRConfig();

  const mutation = useSWRMutation<T, HttpError, string, string>(
    key,
    (_key, { arg }) => {
      return duplicateFn(arg);
    },
    {
      onSuccess: async () => {
        if (revalidateKey) {
          await revalidateRelatedCaches(mutate, revalidateKey);
        }
      },
    },
  );

  return {
    trigger: (id: string) => (mutation.trigger as (id: string) => Promise<T>)(id),
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
  };
}
