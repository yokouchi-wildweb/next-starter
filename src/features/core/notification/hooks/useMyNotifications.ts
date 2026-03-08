// src/features/core/notification/hooks/useMyNotifications.ts
// 自分のお知らせ一覧取得フック

"use client";

import useSWR from "swr";
import {
  getMyNotifications,
  type MyNotification,
} from "../services/client/userNotificationClient";

const SWR_KEY = "/api/notification/my";

type UseMyNotificationsOptions = {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
};

type UseMyNotificationsReturn = {
  notifications: MyNotification[] | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => void;
};

export function useMyNotifications(
  options: UseMyNotificationsOptions = {}
): UseMyNotificationsReturn {
  const { data, error, isLoading, mutate } = useSWR(
    [SWR_KEY, options],
    async () => getMyNotifications(options)
  );

  return {
    notifications: data,
    isLoading,
    error,
    mutate: () => mutate(),
  };
}

export const MY_NOTIFICATIONS_SWR_KEY = SWR_KEY;
