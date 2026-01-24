"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type { BulkUpdateRecord, BulkUpdateResult } from "../types";
import type { HttpError } from "@/lib/errors";

/**
 * 複数レコードを一括で更新するフック
 */
export function useBulkUpdateDomain<T, U = Partial<T>>(
  key: string,
  bulkUpdateFn: (records: BulkUpdateRecord<U>[]) => Promise<BulkUpdateResult<T>>,
  revalidateKey?: string | string[],
) {
  const { mutate } = useSWRConfig();

  const mutation = useSWRMutation<BulkUpdateResult<T>, HttpError, string, BulkUpdateRecord<U>[]>(
    key,
    (_key, { arg }) => bulkUpdateFn(arg),
    {
      onSuccess: async () => {
        if (revalidateKey) {
          await mutate(revalidateKey);
        }
      },
    },
  );

  return {
    trigger: (records: BulkUpdateRecord<U>[]) =>
      (mutation.trigger as (arg: BulkUpdateRecord<U>[]) => Promise<BulkUpdateResult<T>>)(records),
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
    data: mutation.data,
  };
}
