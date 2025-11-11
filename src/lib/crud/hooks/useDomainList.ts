"use client";

import useSWR from "swr";
import { type SWRConfiguration } from "swr";
import type { HttpError } from "@/lib/errors";

/**
 * ドメインの一覧を取得するためのフック
 */
export function useDomainList<T>(
  key: string,
  fetcher: () => Promise<T[]>,
  config?: SWRConfiguration<T[], HttpError>,
) {
  const finalConfig = config?.suspense
    ? { fallbackData: [], ...config }
    : config;

  const { data, error, isLoading, mutate } = useSWR<T[], HttpError>(key, fetcher, finalConfig);

  return {
    data: data ?? [],
    isLoading,
    error,
    mutate,
  };
}
