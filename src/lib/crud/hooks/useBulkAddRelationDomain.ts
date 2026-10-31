"use client";

import { useCallback } from "react";
import type { BulkRelationResult } from "../types";
import { useDomainMutation } from "./internal/useDomainMutation";

/**
 * 複数レコードに同じ関連先を足すフック（既存の関連は残す。再追加は何もしない）
 * 並列 trigger 安全（各 trigger は自分の結果で resolve/reject する。詳細: internal/concurrentMutation.ts）
 */
export function useBulkAddRelationDomain(
  key: string,
  bulkAddRelationFn: (field: string, ids: string[], targetIds: string[]) => Promise<BulkRelationResult>,
  field: string,
  revalidateKey?: string | string[],
) {
  type Arg = { ids: string[]; targetIds: string[] };

  const mutation = useDomainMutation<BulkRelationResult, Arg>(
    key,
    (arg) => bulkAddRelationFn(field, arg.ids, arg.targetIds),
    revalidateKey,
  );
  const { trigger: run } = mutation;

  const trigger = useCallback(
    (ids: string[], targetIds: string[]) => run({ ids, targetIds }),
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
