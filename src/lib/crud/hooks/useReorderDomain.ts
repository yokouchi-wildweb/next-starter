"use client";

import { useCallback } from "react";
import { useDomainMutation } from "./internal/useDomainMutation";

type ReorderArg = {
  id: string;
  afterItemId: string | null;
};

/**
 * 並び替え用フック
 * 並列 trigger 安全（各 trigger は自分の結果で resolve/reject する。詳細: internal/concurrentMutation.ts）
 * @param key SWRキャッシュキー
 * @param reorderFn クライアントサービスのreorderメソッド
 * @param revalidateKey 成功時に再取得するキャッシュキー
 */
export function useReorderDomain<T>(
  key: string,
  reorderFn: (id: string, afterItemId: string | null) => Promise<T>,
  revalidateKey?: string | string[],
) {
  const mutation = useDomainMutation<T, ReorderArg>(
    key,
    (arg) => reorderFn(arg.id, arg.afterItemId),
    revalidateKey,
  );
  const { trigger: run } = mutation;

  const trigger = useCallback(
    (id: string, afterItemId: string | null) => run({ id, afterItemId }),
    [run],
  );

  return {
    trigger,
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
  };
}
