"use client";

// src/features/core/messaging/hooks/useInboxList.ts
//
// 受け取り箱の一覧の流れ(入れ物 InboxList と、一覧を自分で組む fork の画面が呼ぶ):
// - query = useInboxItems(カーソルのモード。InfiniteScrollList に渡す)・unreadCount = 未読の数
// - open(item): 詳細を開き、未読なら既読にして一覧の印を変える(updateItems、取り直さない。失敗は知らせて詳細は見せる)
// - markAll: 全部既読にして一覧の未読の印を変え、結果を知らせる(二度押しは止める)

import { useCallback, useState } from "react";

import { useAsyncAction } from "@/hooks/useAsyncAction";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";

import type { InboxItemDto } from "../services/client/inboxClient";

import { useInboxItems, type UseInboxItemsOptions } from "./useInboxItems";
import { useInboxUnreadCount } from "./useInboxUnreadCount";
import { useMarkAllInboxRead } from "./useMarkAllInboxRead";
import { useMarkInboxItemRead } from "./useMarkInboxItemRead";

export type UseInboxListOptions = UseInboxItemsOptions;

export function useInboxList(options: UseInboxListOptions = {}) {
  const { showToast } = useToast();
  const query = useInboxItems(options);
  const { count: unreadCount } = useInboxUnreadCount({ enabled: options.enabled });
  const { markRead } = useMarkInboxItemRead();
  const { markAllRead } = useMarkAllInboxRead();
  const [opened, setOpened] = useState<InboxItemDto | null>(null);
  const { updateItems } = query;

  const open = useCallback(
    (item: InboxItemDto) => {
      setOpened(item);
      if (item.read) return;
      markRead(item.id)
        .then(() =>
          updateItems(
            (row) => row.id === item.id,
            (row) => ({ ...row, read: true }),
          ),
        )
        .catch((error: unknown) => showToast(err(error, "既読にできませんでした"), "error"));
    },
    [markRead, updateItems, showToast],
  );

  const close = useCallback(() => setOpened(null), []);

  const { execute: markAll, isExecuting: isMarkingAll } = useAsyncAction(async () => {
    try {
      await markAllRead();
      updateItems(
        (row) => !row.read,
        (row) => ({ ...row, read: true }),
      );
      showToast("すべて既読にしました", "success");
    } catch (error) {
      showToast(err(error, "すべて既読にできませんでした"), "error");
    }
  });

  return { query, unreadCount, opened, open, close, markAll, isMarkingAll };
}
