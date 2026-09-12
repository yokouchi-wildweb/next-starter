"use client";

import { useCallback } from "react";
import type { BulkUpsertOptions, BulkUpsertResult } from "../types";
import { useDomainMutation } from "./internal/useDomainMutation";

/**
 * 複数レコードを一括でupsertするフック
 * 並列 trigger 安全（各 trigger は自分の結果で resolve/reject する。詳細: internal/concurrentMutation.ts）
 */
type BulkUpsertArg<A> = { records: A[]; options?: BulkUpsertOptions<A> };

export function useBulkUpsertDomain<T, A = Partial<T>>(
  key: string,
  bulkUpsertFn: (records: A[], options?: BulkUpsertOptions<A>) => Promise<BulkUpsertResult<T>>,
  revalidateKey?: string | string[],
) {
  const mutation = useDomainMutation<BulkUpsertResult<T>, BulkUpsertArg<A>>(
    key,
    (arg) => bulkUpsertFn(arg.records, arg.options),
    revalidateKey,
  );
  const { trigger: run } = mutation;

  const trigger = useCallback(
    (records: A[], options?: BulkUpsertOptions<A>) => run({ records, options }),
    [run],
  );

  return {
    trigger,
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
  };
}
