"use client";

import useSWR from "swr";
import { type SWRConfiguration } from "swr";
import type { HttpError } from "@/lib/errors";

/**
 * 単一ドメインデータ取得用フック
 */
export function useDomain<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  config?: SWRConfiguration<T, HttpError>,
) {
  const { data, error, isLoading, mutate } = useSWR<T, HttpError>(key, fetcher, config);

  return {
    data,
    isLoading,
    error,
    mutate,
  };
}
