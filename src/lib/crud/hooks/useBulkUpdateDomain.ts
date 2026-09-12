"use client";

import { useCallback } from "react";
import type { BulkUpdateRecord, BulkUpdateResult } from "../types";
import { useDomainMutation } from "./internal/useDomainMutation";

/**
 * 複数レコードを一括で更新するフック
 * 並列 trigger 安全（各 trigger は自分の結果で resolve/reject する。詳細: internal/concurrentMutation.ts）
 */
export function useBulkUpdateDomain<T, U = Partial<T>>(
  key: string,
  bulkUpdateFn: (records: BulkUpdateRecord<U>[]) => Promise<BulkUpdateResult<T>>,
  revalidateKey?: string | string[],
) {
  const mutation = useDomainMutation<BulkUpdateResult<T>, BulkUpdateRecord<U>[]>(
    key,
    (records) => bulkUpdateFn(records),
    revalidateKey,
  );
  const { trigger: run } = mutation;

  const trigger = useCallback(
    (records: BulkUpdateRecord<U>[]) => run(records),
    [run],
  );

  return {
    trigger,
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
    data: mutation.data,
  };
}
