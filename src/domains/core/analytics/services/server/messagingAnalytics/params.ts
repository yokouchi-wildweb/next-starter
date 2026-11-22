// src/domains/core/analytics/services/server/messagingAnalytics/params.ts
// 連絡の集計の URL の絞り(channel・messageKey・category)と送信ごとのビューの dispatchIds。DB を読まない(route のテストも本物を使う)

import type { MessagingAnalyticsFilter } from "./types";

export function parseMessagingFilterParams(searchParams: URLSearchParams): MessagingAnalyticsFilter {
  const channel = searchParams.get("channel");
  const messageKey = searchParams.get("messageKey");
  const category = searchParams.get("category");
  return {
    ...(channel && { channel }),
    ...(messageKey && { messageKey }),
    ...(category && { category }),
  };
}

/** 送信ごとのビューの ?dispatchIds=<id,…>(カンマ区切り。無い・空 = undefined。形と件数の検査は service) */
export function parseDispatchIdsParam(searchParams: URLSearchParams): string[] | undefined {
  const raw = searchParams.get("dispatchIds");
  if (raw === null) return undefined;
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id !== "");
  return ids.length > 0 ? ids : undefined;
}
