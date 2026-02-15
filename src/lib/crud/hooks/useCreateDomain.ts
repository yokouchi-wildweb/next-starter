"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type { HttpError } from "@/lib/errors";
import { revalidateRelatedCaches } from "./revalidateRelatedCaches";

/**
 * ドメインデータを新規作成するためのフック
 */
export function useCreateDomain<T, A = Partial<T>>(
  key: string,
  createFn: (data: A) => Promise<T>,
  revalidateKey?: string | string[],
) {
  const { mutate } = useSWRConfig();

  const mutation = useSWRMutation<T, HttpError, string, A>(
    key,
    (_key, { arg }) => {
      return createFn(arg);
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
    trigger: (arg: A) => (mutation.trigger as (arg: A) => Promise<T>)(arg),
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
  };
}
