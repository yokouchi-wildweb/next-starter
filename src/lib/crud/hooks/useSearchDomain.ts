"use client";

import useSWR from "swr";
import type { PaginatedResult } from "../types";
import type { HttpError } from "@/lib/errors";

/**
 * 検索用のフック
 */
export function useSearchDomain<T, P extends Record<string, unknown>>(
  key: string,
  searchFn: (params: P) => Promise<PaginatedResult<T>>,
  params: P,
) {
  const { data, error, isLoading, mutate } = useSWR<PaginatedResult<T>, HttpError>([key, params], () => {
    return searchFn(params);
  });

  return {
    data: data?.results ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    mutate,
  };
}
