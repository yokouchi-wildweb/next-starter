"use client";

import useSWR from "swr";
import type { CountResult } from "../types";
import type { HttpError } from "@/lib/errors";

/**
 * 件数取得用の汎用フック
 */
export function useCountDomain<P extends Record<string, unknown>>(
  key: string,
  countFn: (params: P) => Promise<CountResult>,
  params: P,
) {
  const { data, error, isLoading, mutate } = useSWR<CountResult, HttpError>([key, params], () => {
    return countFn(params);
  });

  return {
    total: data?.total ?? 0,
    isLoading,
    error,
    mutate,
  };
}
