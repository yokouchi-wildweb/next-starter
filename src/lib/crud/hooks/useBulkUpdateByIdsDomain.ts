"use client";

import { useCallback } from "react";
import { useDomainMutation } from "./internal/useDomainMutation";

/**
 * 複数IDのレコードを同一データで一括更新するフック
 * 並列 trigger 安全（各 trigger は自分の結果で resolve/reject する。詳細: internal/concurrentMutation.ts）
 */
export function useBulkUpdateByIdsDomain<T>(
  key: string,
  bulkUpdateByIdsFn: (ids: string[], data: Partial<T>) => Promise<{ count: number }>,
  revalidateKey?: string | string[],
) {
  type Arg = { ids: string[]; data: Partial<T> };

  const mutation = useDomainMutation<{ count: number }, Arg>(
    key,
    (arg) => bulkUpdateByIdsFn(arg.ids, arg.data),
    revalidateKey,
  );
  const { trigger: run } = mutation;

  const trigger = useCallback(
    (ids: string[], data: Partial<T>) => run({ ids, data }),
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
