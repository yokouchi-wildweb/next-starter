"use client";

// src/features/core/messaging/hooks/useInboxItems.ts
//
// 本人の受け取り箱の一覧(無限スクロール、カーソルのモード)。
// 画面は @/components/Widgets/InfiniteScrollList に items / hasMore / sentinelRef を渡す。
// 既読にしたら updateItems で read を true にする(未読だけの一覧から外すなら removeItems。カーソルは位置がずれない)

import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";

import { listInbox, type InboxItemDto } from "../services/client/inboxClient";

const DEFAULT_LIMIT = 20;

export type UseInboxItemsOptions = {
  /** true = 未読だけ */
  unreadOnly?: boolean;
  /** 1 回の件数(既定 20、最大 50) */
  limit?: number;
  /** false で取得を止める(未ログインなど) */
  enabled?: boolean;
  /** タブに戻ったときに先頭を取り直す */
  revalidateOnFocus?: boolean;
  /** IntersectionObserver のオプション(先読みの距離など) */
  observerOptions?: IntersectionObserverInit;
};

export function useInboxItems(options: UseInboxItemsOptions = {}) {
  const { unreadOnly = false, limit = DEFAULT_LIMIT, enabled, revalidateOnFocus, observerOptions } = options;
  return useInfiniteScrollQuery<InboxItemDto, Record<string, never>>({
    cursorFetcher: ({ cursor, limit: pageLimit }) => listInbox({ cursor, limit: pageLimit, unreadOnly }),
    limit,
    enabled,
    revalidateOnFocus,
    observerOptions,
    deps: [unreadOnly, limit],
  });
}
