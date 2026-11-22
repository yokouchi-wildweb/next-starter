"use client";

// src/domains/core/messaging/hooks/useAdminDispatchReadCounts.ts
//
// 管理: 送信の一覧の既読数の列(ui.readCount)。読み込んだ行の送信の id を集計の公開の hook(analytics の useMessagingAnalyticsDispatchReads)に渡す。
// - 門 messagingAnalytics が閉 = 取らない(集計の口を呼ばない)・enabled false・readCountOf は undefined(列ごと出さない)
// - 開 = readCountOf(id) は集計の行の read。行が無い送信(予約・取り消し・テストの送信、送信の管理 messagingDispatches が閉)は null(「-」)
// - id は何件でも(集計の hook が 100 件ずつに分けて取る)。一覧が伸びて id の組が変われば取り直す

import { useCallback, useMemo } from "react";

import { useGate } from "@/featureGate/client";
import { useMessagingAnalyticsDispatchReads } from "@/domains/core/analytics/hooks/useMessagingAnalyticsDispatchReads";

export function useAdminDispatchReadCounts(ids: readonly string[]) {
  const enabled = useGate().enabled("messagingAnalytics");
  const reads = useMessagingAnalyticsDispatchReads(ids, { enabled });
  const { rows } = reads;
  const readCountOf = useCallback((id: string): number | null => rows.get(id)?.metrics.read ?? null, [rows]);
  return useMemo(
    () => ({
      /** 列を出すか(門 messagingAnalytics が開) */
      enabled,
      /** 送信の既読数(門が閉 = undefined = 列なし / 行が無い = null =「-」) */
      readCountOf: (id: string): number | null | undefined => (enabled ? readCountOf(id) : undefined),
      isLoading: reads.isLoading,
      error: reads.error,
    }),
    [enabled, readCountOf, reads.isLoading, reads.error],
  );
}
