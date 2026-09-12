"use client";

import { useCallback } from "react";
import type { ReplaceByQueryOptions, WhereExpr } from "../types";
import { useDomainMutation } from "./internal/useDomainMutation";

/**
 * where 一致行を records で丸ごと置き換えるフック（単一トランザクション・Drizzle のみ）
 * 並列 trigger 安全（各 trigger は自分の結果で resolve/reject する。詳細: internal/concurrentMutation.ts）
 */
type ReplaceByQueryArg<A> = {
  where: WhereExpr;
  records: A[];
  options?: ReplaceByQueryOptions;
};

export function useReplaceByQueryDomain<T, A = Partial<T>>(
  key: string,
  replaceByQueryFn: (
    where: WhereExpr,
    records: A[],
    options?: ReplaceByQueryOptions,
  ) => Promise<T[]>,
  revalidateKey?: string | string[],
) {
  const mutation = useDomainMutation<T[], ReplaceByQueryArg<A>>(
    key,
    (arg) => replaceByQueryFn(arg.where, arg.records, arg.options),
    revalidateKey,
  );
  const { trigger: run } = mutation;

  const trigger = useCallback(
    (where: WhereExpr, records: A[], options?: ReplaceByQueryOptions) =>
      run({ where, records, options }),
    [run],
  );

  return {
    trigger,
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
  };
}
