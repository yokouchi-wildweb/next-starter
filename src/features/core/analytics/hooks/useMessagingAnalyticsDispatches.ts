// src/features/core/analytics/hooks/useMessagingAnalyticsDispatches.ts
// 連絡の集計の回ごとの指標(無限スクロール、カーソルのモード。送った時刻の新しい順)。期間・絞りが変われば先頭から取り直す。
// 画面は @/components/Widgets/InfiniteScrollList に items / hasMore / sentinelRef を渡す。
// dispatchesEnabled(回の管理 messagingDispatches が開か)・trackingEnabled(開封・クリックの計測が開か)は直近の応答の値(まだ無ければ null)

"use client";

import { useState } from "react";

import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";
import type { MessagingDispatchRow } from "@/features/core/analytics/services/server/messagingAnalytics";
import {
  fetchMessagingDispatches,
  type MessagingAnalyticsClientParams,
} from "@/features/core/analytics/services/client/messagingAnalyticsClient";

const DEFAULT_LIMIT = 20;

export type UseMessagingAnalyticsDispatchesOptions = {
  params?: MessagingAnalyticsClientParams;
  /** 1 回の件数(既定 20、最大 100) */
  limit?: number;
  enabled?: boolean;
  observerOptions?: IntersectionObserverInit;
};

type Flags = { dispatchesEnabled: boolean | null; trackingEnabled: boolean | null };

export function useMessagingAnalyticsDispatches(options: UseMessagingAnalyticsDispatchesOptions = {}) {
  const { params = {}, limit = DEFAULT_LIMIT, enabled, observerOptions } = options;
  const { days, dateFrom, dateTo, timezone, granularity, alignToGranularity, channel, messageKey, category } = params;
  const [flags, setFlags] = useState<Flags>({ dispatchesEnabled: null, trackingEnabled: null });

  const query = useInfiniteScrollQuery<MessagingDispatchRow, Record<string, never>>({
    cursorFetcher: async ({ cursor, limit: pageLimit }) => {
      const page = await fetchMessagingDispatches({
        days,
        dateFrom,
        dateTo,
        timezone,
        granularity,
        alignToGranularity,
        channel,
        messageKey,
        category,
        cursor,
        limit: pageLimit,
      });
      setFlags({ dispatchesEnabled: page.dispatchesEnabled, trackingEnabled: page.trackingEnabled });
      return { items: page.items, nextCursor: page.nextCursor };
    },
    limit,
    enabled,
    observerOptions,
    deps: [days, dateFrom, dateTo, timezone, granularity, alignToGranularity, channel, messageKey, category, limit],
  });

  return { ...query, ...flags };
}
