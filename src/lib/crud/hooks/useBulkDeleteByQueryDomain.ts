"use client";

import { useCallback } from "react";
import type { WhereExpr } from "@/lib/crud/types";
import { useDomainMutation } from "./internal/useDomainMutation";

/**
 * where 条件での複数削除用フック
 * 並列 trigger 安全（各 trigger は自分の結果で resolve/reject する。詳細: internal/concurrentMutation.ts）
 */
export function useBulkDeleteByQueryDomain(
  key: string,
  bulkDeleteByQueryFn: (where: WhereExpr) => Promise<void>,
  revalidateKey?: string | string[],
) {
  const mutation = useDomainMutation<void, WhereExpr>(
    key,
    (where) => bulkDeleteByQueryFn(where),
    revalidateKey,
  );
  const { trigger: run } = mutation;

  const trigger = useCallback((where: WhereExpr) => run(where), [run]);

  return {
    trigger,
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
  };
}
