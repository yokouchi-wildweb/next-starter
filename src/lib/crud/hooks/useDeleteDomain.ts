"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type { HttpError } from "@/lib/errors";

/**
 * ドメインデータを削除するためのフック
 */
export function useDeleteDomain(
  key: string,
  deleteFn: (id: string) => Promise<void>,
  revalidateKey?: string | string[],
) {
  const { mutate } = useSWRConfig();

  const mutation = useSWRMutation<void, HttpError, string, string>(
    key,
    (_key, { arg }) => deleteFn(arg),
    {
      onSuccess: async () => {
        if (revalidateKey) {
          await mutate(revalidateKey);
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
