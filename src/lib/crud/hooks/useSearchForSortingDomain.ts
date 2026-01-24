"use client";

import useSWR from "swr";
import type { SearchParams, PaginatedResult } from "../types";
import type { HttpError } from "@/lib/errors";

/**
 * ソート画面用検索フック
 * sort_order が NULL のレコードを自動初期化する
 */
export function useSearchForSortingDomain<T>(
  key: string | null,
  searchForSortingFn: (params: SearchParams) => Promise<PaginatedResult<T>>,
  params: SearchParams,
) {
  const { data, error, isLoading, mutate } = useSWR<PaginatedResult<T>, HttpError>(
    key ? [key, params] : null,
    () => searchForSortingFn(params),
  );

  return {
    data: data?.results ?? [],
    total: data?.total ?? 0,
    error,
    isLoading,
    mutate,
  };
}
