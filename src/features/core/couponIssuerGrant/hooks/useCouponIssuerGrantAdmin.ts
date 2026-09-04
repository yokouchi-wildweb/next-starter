"use client";

// src/features/core/couponIssuerGrant/hooks/useCouponIssuerGrantAdmin.ts
//
// 管理画面用フック。一覧は page / sort / status をキーに SWR キャッシュする。

import useSWR from "swr";

import {
  fetchGrantListWithStats,
  fetchGrantStats,
  fetchIssuerRewardHistory,
  fetchIssuerUsageHistory,
  type GrantListWithStatsQuery,
} from "@/features/core/couponIssuerGrant/services/client/couponIssuerGrantAdminClient";

const KEY = "/api/admin/coupon-issuer-grants";

/** 発行権一覧 + 統計 */
export function useCouponIssuerGrantListWithStats(query: GrantListWithStatsQuery = {}) {
  const { data, error, isLoading, mutate } = useSWR(
    [KEY, JSON.stringify(query)],
    () => fetchGrantListWithStats(query),
    { keepPreviousData: true },
  );
  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    grandTotals: data?.grandTotals ?? null,
    period: data?.period ?? null,
    error,
    isLoading,
    mutate: () => mutate(),
  };
}

/** 発行権 1 件の統計（詳細画面ヘッダ） */
export function useCouponIssuerStats(grantId: string | null | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    grantId ? [KEY, grantId, "stats"] : null,
    () => fetchGrantStats(grantId as string),
  );
  return { stats: data ?? null, error, isLoading, mutate: () => mutate() };
}

/** 発行者の利用履歴（ページング） */
export function useCouponIssuerUsageHistory(
  grantId: string | null | undefined,
  params: { page?: number; limit?: number } = {},
) {
  const { data, error, isLoading, mutate } = useSWR(
    grantId ? [KEY, grantId, "usage-history", params.page ?? 1, params.limit ?? 20] : null,
    () => fetchIssuerUsageHistory(grantId as string, params),
    { keepPreviousData: true },
  );
  return { items: data?.items ?? [], total: data?.total ?? 0, error, isLoading, mutate: () => mutate() };
}

/** 発行者の報酬履歴（ページング） */
export function useCouponIssuerRewardHistory(
  grantId: string | null | undefined,
  params: { page?: number; limit?: number } = {},
) {
  const { data, error, isLoading, mutate } = useSWR(
    grantId ? [KEY, grantId, "reward-history", params.page ?? 1, params.limit ?? 20] : null,
    () => fetchIssuerRewardHistory(grantId as string, params),
    { keepPreviousData: true },
  );
  return { items: data?.items ?? [], total: data?.total ?? 0, error, isLoading, mutate: () => mutate() };
}
