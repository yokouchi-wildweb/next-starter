"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type { HttpError } from "@/lib/errors";

/**
 * ソフトデリートされたドメインデータを復旧するためのフック
 */
export function useRestoreDomain<T>(
  key: string,
  restoreFn: (id: string) => Promise<T>,
  revalidateKey?: string | string[],
) {
  const { mutate } = useSWRConfig();

  const mutation = useSWRMutation<T, HttpError, string, string>(
    key,
    (_key, { arg }) => restoreFn(arg),
    {
      onSuccess: async () => {
        if (revalidateKey) {
          await mutate(revalidateKey);
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
