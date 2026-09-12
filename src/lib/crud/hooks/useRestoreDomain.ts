"use client";

import { useCallback } from "react";
import { useDomainMutation } from "./internal/useDomainMutation";

/**
 * ソフトデリートされたドメインデータを復旧するためのフック
 * 並列 trigger 安全（各 trigger は自分の結果で resolve/reject する。詳細: internal/concurrentMutation.ts）
 */
export function useRestoreDomain<T>(
  key: string,
  restoreFn: (id: string) => Promise<T>,
  revalidateKey?: string | string[],
) {
  const mutation = useDomainMutation<T, string>(key, (id) => restoreFn(id), revalidateKey);
  const { trigger: run } = mutation;

  const trigger = useCallback((id: string) => run(id), [run]);

  return {
    trigger,
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
  };
}
