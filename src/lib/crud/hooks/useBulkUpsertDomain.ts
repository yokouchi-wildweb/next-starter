"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type { BulkUpsertOptions, BulkUpsertResult } from "../types";
import type { HttpError } from "@/lib/errors";

/**
 * 複数レコードを一括でupsertするフック
 */
type BulkUpsertArg<A> = { records: A[]; options?: BulkUpsertOptions<A> };

export function useBulkUpsertDomain<T, A = Partial<T>>(
  key: string,
  bulkUpsertFn: (records: A[], options?: BulkUpsertOptions<A>) => Promise<BulkUpsertResult<T>>,
  revalidateKey?: string | string[],
) {
  const { mutate } = useSWRConfig();

  const mutation = useSWRMutation<BulkUpsertResult<T>, HttpError, string, BulkUpsertArg<A>>(
    key,
    (_key, { arg }) => bulkUpsertFn(arg.records, arg.options),
    {
      onSuccess: async () => {
        if (revalidateKey) {
          await mutate(revalidateKey);
        }
      },
    },
  );

  return {
    trigger: (records: A[], options?: BulkUpsertOptions<A>) =>
      (mutation.trigger as (arg: BulkUpsertArg<A>) => Promise<BulkUpsertResult<T>>)({ records, options }),
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
  };
}
