"use client";

// src/features/core/messaging/hooks/useInboxUnreadCount.ts
//
// 本人の未読の数(SWR)。既読の mutation(useMarkInboxItemRead / useMarkAllInboxRead)が再検証する

import useSWR from "swr";

import { getInboxUnreadCount } from "../services/client/inboxClient";

import { INBOX_UNREAD_COUNT_KEY } from "./inboxKeys";

export function useInboxUnreadCount(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const { data, error, isLoading, mutate } = useSWR<number>(enabled ? INBOX_UNREAD_COUNT_KEY : null, () =>
    getInboxUnreadCount(),
  );
  return { count: data ?? 0, error, isLoading, revalidate: () => mutate() };
}
