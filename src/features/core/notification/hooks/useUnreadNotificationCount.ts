// src/features/core/notification/hooks/useUnreadNotificationCount.ts
// 未読数取得フック（バッジ表示用）

"use client";

import useSWR from "swr";
import { getUnreadCount } from "../services/client/userNotificationClient";

const SWR_KEY = "/api/notification/my/unread-count";

type UseUnreadNotificationCountReturn = {
  count: number | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => void;
};

export function useUnreadNotificationCount(): UseUnreadNotificationCountReturn {
  const { data, error, isLoading, mutate } = useSWR(
    SWR_KEY,
    async () => getUnreadCount()
  );

  return {
    count: data,
    isLoading,
    error,
    mutate: () => mutate(),
  };
}

export const UNREAD_NOTIFICATION_COUNT_SWR_KEY = SWR_KEY;
