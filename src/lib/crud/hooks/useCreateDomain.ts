"use client";

import { useCallback } from "react";
import { useDomainMutation } from "./internal/useDomainMutation";

/**
 * ドメインデータを新規作成するためのフック
 * 並列 trigger 安全（各 trigger は自分の結果で resolve/reject する。詳細: internal/concurrentMutation.ts）
 */
export function useCreateDomain<T, A = Partial<T>>(
  key: string,
  createFn: (data: A) => Promise<T>,
  revalidateKey?: string | string[],
) {
  const mutation = useDomainMutation<T, A>(key, (arg) => createFn(arg), revalidateKey);
  const { trigger: run } = mutation;

  const trigger = useCallback((arg: A) => run(arg), [run]);

  return {
    trigger,
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
  };
}
