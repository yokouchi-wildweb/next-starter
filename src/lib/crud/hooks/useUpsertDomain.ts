"use client";

import { useCallback } from "react";
import type { UpsertOptions } from "../types";
import { useDomainMutation } from "./internal/useDomainMutation";

/**
 * 存在すれば更新、無ければ作成するフック
 * 並列 trigger 安全（各 trigger は自分の結果で resolve/reject する。詳細: internal/concurrentMutation.ts）
 */
type UpsertArg<A> = { data: A; options?: UpsertOptions<A> };

export function useUpsertDomain<T, A = Partial<T>>(
  key: string,
  upsertFn: (data: A, options?: UpsertOptions<A>) => Promise<T>,
  revalidateKey?: string | string[],
) {
  const mutation = useDomainMutation<T, UpsertArg<A>>(
    key,
    (arg) => upsertFn(arg.data, arg.options),
    revalidateKey,
  );
  const { trigger: run } = mutation;

  const trigger = useCallback(
    (data: A, options?: UpsertOptions<A>) => run({ data, options }),
    [run],
  );

  return {
    trigger,
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
  };
}
