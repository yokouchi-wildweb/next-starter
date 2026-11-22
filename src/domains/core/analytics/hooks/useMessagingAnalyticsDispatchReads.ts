// src/domains/core/analytics/hooks/useMessagingAnalyticsDispatchReads.ts
// 渡した送信だけの集計の指標(GET /api/admin/analytics/messaging/dispatches?dispatchIds=、期間なし)。messaging の送信の一覧の既読数の列が読む公開の hook。
// - ids は何件でも(重なりと順は見ない: 同じ組 = 同じ鍵)。並べた id を 100 件(口の上限 DISPATCH_IDS_MAX)ずつに分けて並べて取り、1 つにまとめる。
//   一覧が伸びて組が変われば全部を取り直す(前の塊の並びは変わらない)。空なら取らない。enabled: false も取らない
// - rows = 送信の id → 行(予約・取り消し・テストの送信と、送信の管理 messagingDispatches が閉の時は入らない = 画面は「-」)
// - dispatchesEnabled・trackingEnabled は応答の値(まだ無ければ null)

"use client";

import { useMemo } from "react";
import useSWR, { type SWRConfiguration } from "swr";

import type { MessagingDispatchRow } from "@/domains/core/analytics/services/server/messagingAnalytics";
import { fetchMessagingDispatches } from "@/domains/core/analytics/services/client/messagingAnalyticsClient";

/** 1 回の口に渡す送信の数の上限(サーバーの DISPATCH_IDS_MAX と同じ値。サーバーの入口は client に持ち込まない) */
export const DISPATCH_READS_CHUNK = 100;

/** 並べた id を上限ずつの塊に分ける */
export function dispatchReadChunks(sortedIds: readonly string[]): string[][] {
  const chunks: string[][] = [];
  for (let start = 0; start < sortedIds.length; start += DISPATCH_READS_CHUNK) chunks.push(sortedIds.slice(start, start + DISPATCH_READS_CHUNK));
  return chunks;
}

export function useMessagingAnalyticsDispatchReads(
  ids: readonly string[],
  options: { enabled?: boolean; config?: SWRConfiguration } = {},
) {
  const sorted = useMemo(() => [...new Set(ids)].sort(), [ids]);
  const joined = sorted.join(",");
  const key = options.enabled === false || sorted.length === 0 ? null : (["messagingAnalyticsDispatchReads", joined] as const);
  const swr = useSWR(
    key,
    async () => {
      const pages = await Promise.all(dispatchReadChunks(joined.split(",")).map((chunk) => fetchMessagingDispatches({ dispatchIds: chunk })));
      const first = pages[0]!;
      return { ...first, items: pages.flatMap((page) => page.items) };
    },
    options.config,
  );
  const rows = useMemo(
    () => new Map<string, MessagingDispatchRow>((swr.data?.items ?? []).map((row) => [row.dispatchId, row])),
    [swr.data],
  );
  return {
    rows,
    dispatchesEnabled: swr.data?.dispatchesEnabled ?? null,
    trackingEnabled: swr.data?.trackingEnabled ?? null,
    isLoading: swr.isLoading,
    error: swr.error,
    mutate: swr.mutate,
  };
}
