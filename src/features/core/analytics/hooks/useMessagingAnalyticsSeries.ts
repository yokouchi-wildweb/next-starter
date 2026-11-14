// src/features/core/analytics/hooks/useMessagingAnalyticsSeries.ts
// 連絡の集計のバケット別の指標(granularity)の取得フック。params が変われば取り直す。enabled: false なら取らない

"use client";

import useSWR, { type SWRConfiguration } from "swr";
import {
  fetchMessagingSeries,
  type MessagingAnalyticsClientParams,
} from "@/features/core/analytics/services/client/messagingAnalyticsClient";
import { messagingAnalyticsParamsKey } from "./useMessagingAnalyticsSummary";

export function useMessagingAnalyticsSeries(
  params: MessagingAnalyticsClientParams = {},
  options: { enabled?: boolean; config?: SWRConfiguration } = {},
) {
  const key =
    options.enabled === false ? null : (["messagingAnalyticsSeries", ...messagingAnalyticsParamsKey(params)] as const);
  return useSWR(key, () => fetchMessagingSeries(params), options.config);
}
