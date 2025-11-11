"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type { HttpError } from "@/lib/errors";

/**
 * ドメインデータを更新するためのフック
 */
export function useUpdateDomain<T, U = Partial<T>>(
  key: string,
  updateFn: (id: string, data: U) => Promise<T>,
  revalidateKey?: string | string[],
) {
  const { mutate } = useSWRConfig();

  type Arg = { id: string; data: U };

  const mutation = useSWRMutation<T, HttpError, string, Arg>(
    key,
    (_key, { arg }) => updateFn(arg.id, arg.data),
    {
      onSuccess: async () => {
        if (revalidateKey) {
          await mutate(revalidateKey);
        }
      },
    },
  );

  return {
    trigger: (arg: Arg) => (mutation.trigger as (arg: Arg) => Promise<T>)(arg),
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
  };
}
