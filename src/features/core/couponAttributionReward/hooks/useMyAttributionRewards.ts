"use client";

// src/features/core/couponAttributionReward/hooks/useMyAttributionRewards.ts

import useSWR from "swr";

import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";
import {
  fetchMyAttributionRewards,
  fetchMyAttributionRewardSummary,
} from "@/features/core/couponAttributionReward/services/client/couponAttributionRewardClient";
import type { CouponAttributionReward } from "@/features/core/couponAttributionReward/entities/model";

const DEFAULT_LIMIT = 20;

/**
 * 自分の帰属報酬履歴（無限スクロール）。
 * 画面は @/components/Widgets/InfiniteScrollList に items / hasMore / sentinelRef を渡す。
 */
export function useMyAttributionRewards(options: { limit?: number; enabled?: boolean } = {}) {
  return useInfiniteScrollQuery<CouponAttributionReward, Record<string, never>>({
    fetcher: ({ page, limit }) => fetchMyAttributionRewards({ page, limit }),
    limit: options.limit ?? DEFAULT_LIMIT,
    enabled: options.enabled,
  });
}

export const MY_ATTRIBUTION_REWARD_SUMMARY_SWR_KEY = "/api/me/coupon-attribution-rewards/summary";

/** 自分の帰属報酬の集計（累計額・件数） */
export function useMyAttributionRewardSummary() {
  const { data, error, isLoading, mutate } = useSWR(
    MY_ATTRIBUTION_REWARD_SUMMARY_SWR_KEY,
    fetchMyAttributionRewardSummary,
  );
  return { summary: data, error, isLoading, mutate: () => mutate() };
}
