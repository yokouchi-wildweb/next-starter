"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type { HttpError } from "@/lib/errors";

/**
 * 複数IDのレコードを同一データで一括更新するフック
 */
export function useBulkUpdateByIdsDomain<T>(
  key: string,
  bulkUpdateByIdsFn: (ids: string[], data: Partial<T>) => Promise<{ count: number }>,
  revalidateKey?: string | string[],
) {
  const { mutate } = useSWRConfig();

  const mutation = useSWRMutation<
    { count: number },
    HttpError,
    string,
    { ids: string[]; data: Partial<T> }
  >(
    key,
    (_key, { arg }) => bulkUpdateByIdsFn(arg.ids, arg.data),
    {
      onSuccess: async () => {
        if (revalidateKey) {
          await mutate(revalidateKey);
        }
      },
    },
  );

  return {
    trigger: (ids: string[], data: Partial<T>) =>
      (mutation.trigger as (arg: { ids: string[]; data: Partial<T> }) => Promise<{ count: number }>)({
        ids,
        data,
      }),
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
    data: mutation.data,
  };
}
