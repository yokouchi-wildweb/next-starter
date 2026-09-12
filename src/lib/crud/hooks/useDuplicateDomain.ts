"use client";

import { useCallback } from "react";
import type { DuplicateOptions } from "../types";
import { useDomainMutation } from "./internal/useDomainMutation";

type DuplicateArg = {
  id: string;
  options?: DuplicateOptions;
};

/**
 * ドメインデータを複製するためのフック
 * 並列 trigger 安全（各 trigger は自分の結果で resolve/reject する。詳細: internal/concurrentMutation.ts）
 */
export function useDuplicateDomain<T>(
  key: string,
  duplicateFn: (id: string, options?: DuplicateOptions) => Promise<T>,
  revalidateKey?: string | string[],
) {
  const mutation = useDomainMutation<T, DuplicateArg>(
    key,
    (arg) => duplicateFn(arg.id, arg.options),
    revalidateKey,
  );
  const { trigger: run } = mutation;

  const trigger = useCallback(
    (id: string, options?: DuplicateOptions) => run({ id, options }),
    [run],
  );

  return {
    trigger,
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
  };
}
