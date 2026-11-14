// src/features/core/analytics/hooks/useMessagingAnalyticsSummary.ts
// 連絡の集計の期間の合計(指標・率・前期比)の取得フック。params が変われば取り直す。enabled: false なら取らない

"use client";

import useSWR, { type SWRConfiguration } from "swr";
import {
  fetchMessagingSummary,
  type MessagingAnalyticsClientParams,
} from "@/features/core/analytics/services/client/messagingAnalyticsClient";

/** SWR の鍵の中の期間と絞り(同じ値 = 同じ鍵) */
export function messagingAnalyticsParamsKey(params: MessagingAnalyticsClientParams) {
  return [
    params.days ?? null,
    params.dateFrom ?? null,
    params.dateTo ?? null,
    params.timezone ?? null,
    params.granularity ?? null,
    params.alignToGranularity ?? false,
    params.channel ?? null,
    params.messageKey ?? null,
    params.category ?? null,
  ] as const;
}

export function useMessagingAnalyticsSummary(
  params: MessagingAnalyticsClientParams = {},
  options: { enabled?: boolean; config?: SWRConfiguration } = {},
) {
  const key =
    options.enabled === false ? null : (["messagingAnalyticsSummary", ...messagingAnalyticsParamsKey(params)] as const);
  return useSWR(key, () => fetchMessagingSummary(params), options.config);
}
