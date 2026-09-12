"use client";

import { useCallback } from "react";
import { useDomainMutation } from "./internal/useDomainMutation";

/**
 * ドメインデータを更新するためのフック
 * 並列 trigger 安全（各 trigger は自分の結果で resolve/reject する。詳細: internal/concurrentMutation.ts）
 */
export function useUpdateDomain<T, U = Partial<T>>(
  key: string,
  updateFn: (id: string, data: U) => Promise<T>,
  revalidateKey?: string | string[],
) {
  type Arg = { id: string; data: U };

  const mutation = useDomainMutation<T, Arg>(
    key,
    (arg) => updateFn(arg.id, arg.data),
    revalidateKey,
  );
  const { trigger: run } = mutation;

  const trigger = useCallback((arg: Arg) => run(arg), [run]);

  return {
    trigger,
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
  };
}
