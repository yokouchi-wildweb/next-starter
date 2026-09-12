"use client";

import { useCallback } from "react";
import { useDomainMutation } from "./internal/useDomainMutation";

/**
 * ID 配列での複数削除用フック
 * 並列 trigger 安全（各 trigger は自分の結果で resolve/reject する。詳細: internal/concurrentMutation.ts）
 */
export function useBulkDeleteByIdsDomain(
  key: string,
  bulkDeleteByIdsFn: (ids: string[]) => Promise<void>,
  revalidateKey?: string | string[],
) {
  const mutation = useDomainMutation<void, string[]>(
    key,
    (ids) => bulkDeleteByIdsFn(ids),
    revalidateKey,
  );
  const { trigger: run } = mutation;

  const trigger = useCallback((ids: string[]) => run(ids), [run]);

  return {
    trigger,
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
  };
}
