"use client";

import useSWR from "swr";
import type { PaginatedResult } from "../types";
import type { HttpError } from "@/lib/errors";

/**
 * 検索用のフック
 * enabled: false を渡すとリクエスト自体を発行しない（SWR の key を null にする）
 */
export function useSearchDomain<T, P extends Record<string, unknown>>(
  key: string,
  searchFn: (params: P) => Promise<PaginatedResult<T>>,
  params: P & { enabled?: boolean },
) {
  const { enabled, ...searchParams } = params;
  const swrKey = enabled === false ? null : [key, searchParams];

  const { data, error, isLoading, mutate } = useSWR<PaginatedResult<T>, HttpError>(swrKey, () => {
    return searchFn(searchParams as P);
  });

  return {
    data: data?.results ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    mutate,
  };
}
