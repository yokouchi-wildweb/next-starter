// src/features/core/analytics/hooks/useMessagingAnalyticsBreakdown.ts
// 連絡の集計の軸ごとの内訳(axis = channel / message / category / template / tag)の取得フック。
// axis が null・undefined か enabled: false なら取らない。axis・params が変われば取り直す

"use client";

import useSWR, { type SWRConfiguration } from "swr";
import type { MessagingBreakdownAxis } from "@/features/core/analytics/services/server/messagingAnalytics";
import {
  fetchMessagingBreakdown,
  type MessagingAnalyticsClientParams,
} from "@/features/core/analytics/services/client/messagingAnalyticsClient";
import { messagingAnalyticsParamsKey } from "./useMessagingAnalyticsSummary";

export function useMessagingAnalyticsBreakdown(
  axis: MessagingBreakdownAxis | null | undefined,
  params: MessagingAnalyticsClientParams = {},
  options: { enabled?: boolean; config?: SWRConfiguration } = {},
) {
  const key =
    !axis || options.enabled === false
      ? null
      : (["messagingAnalyticsBreakdown", axis, ...messagingAnalyticsParamsKey(params)] as const);
  return useSWR(key, () => fetchMessagingBreakdown(axis as MessagingBreakdownAxis, params), options.config);
}
