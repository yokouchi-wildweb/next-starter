// src/features/core/analytics/services/server/messagingAnalytics/params.ts
// 連絡の集計の URL の絞り(channel・messageKey・category)。DB を読まない(route のテストも本物を使う)

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
