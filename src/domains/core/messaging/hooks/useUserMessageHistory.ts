"use client";

// src/domains/core/messaging/hooks/useUserMessageHistory.ts
//
// 利用者ごとの連絡の履歴(公開の hook、D37・D215): その利用者が受けた送信(1 送信 1 行 = type "dispatch"、メール・お知らせの配達は channels、
// 送った人 actor・理由 reason)と、その利用者の受け取り箱に見える全員・ロール宛ての共有のお知らせ(type "sharedInApp"、配達の状態なし)を
// 時刻の新しい順に無限スクロール(カーソルのモード)。sentBy で運営の送信(admin)と自動の送信(system)を分ける。本文は行の dispatchId で
// 送信の詳細のモーダル(AdminDispatchDetailModal)を開いて見る。
// 上流は画面を出さない(利用者の管理画面などに fork が置く)。行の形: services/server/history/README.md

import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";

import { getAdminUserMessageHistory, type UserMessageHistoryItem } from "../services/client/userHistoryClient";
import type { DispatchSentBy } from "../types/dispatchSentBy";

const DEFAULT_LIMIT = 50;

export type UseUserMessageHistoryOptions = {
  /** 1 回の件数(既定 50、最大 100) */
  limit?: number;
  /** admin = 管理者が送った送信だけ / system = それ以外(連絡の自動の送信)/ 無し = 全部 */
  sentBy?: DispatchSentBy;
  enabled?: boolean;
  observerOptions?: IntersectionObserverInit;
};

/** userId = 見る利用者(null = 取らない) */
export function useUserMessageHistory(userId: string | null, options: UseUserMessageHistoryOptions = {}) {
  const { limit = DEFAULT_LIMIT, sentBy, enabled = true, observerOptions } = options;
  return useInfiniteScrollQuery<UserMessageHistoryItem, Record<string, never>>({
    cursorFetcher: ({ cursor, limit: pageLimit }) => getAdminUserMessageHistory(userId as string, { cursor, limit: pageLimit, sentBy }),
    limit,
    enabled: enabled && userId !== null,
    observerOptions,
    deps: [userId, limit, sentBy],
  });
}
