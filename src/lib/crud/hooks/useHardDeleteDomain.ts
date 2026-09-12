"use client";

import { useCallback } from "react";
import { useDomainMutation } from "./internal/useDomainMutation";

/**
 * ドメインデータを完全削除（物理削除）するためのフック
 * 並列 trigger 安全（各 trigger は自分の結果で resolve/reject する。詳細: internal/concurrentMutation.ts）
 */
export function useHardDeleteDomain(
  key: string,
  hardDeleteFn: (id: string) => Promise<void>,
  revalidateKey?: string | string[],
) {
  const mutation = useDomainMutation<void, string>(key, (id) => hardDeleteFn(id), revalidateKey);
  const { trigger: run } = mutation;

  const trigger = useCallback((id: string) => run(id), [run]);

  return {
    trigger,
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
  };
}
