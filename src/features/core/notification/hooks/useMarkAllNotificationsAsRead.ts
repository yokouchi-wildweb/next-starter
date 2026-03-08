// src/features/core/notification/hooks/useMarkAllNotificationsAsRead.ts
// 全既読マークフック

"use client";

import { useState, useCallback } from "react";
import { useSWRConfig } from "swr";
import { markAllAsRead } from "../services/client/userNotificationClient";
import { MY_NOTIFICATIONS_SWR_KEY } from "./useMyNotifications";
import { UNREAD_NOTIFICATION_COUNT_SWR_KEY } from "./useUnreadNotificationCount";

type UseMarkAllNotificationsAsReadReturn = {
  markAllAsRead: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
};

export function useMarkAllNotificationsAsRead(): UseMarkAllNotificationsAsReadReturn {
  const { mutate } = useSWRConfig();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleMarkAllAsRead = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await markAllAsRead();
      // 一覧と未読数のキャッシュを更新
      mutate((key: unknown) =>
        typeof key === "string"
          ? key.startsWith(MY_NOTIFICATIONS_SWR_KEY) || key === UNREAD_NOTIFICATION_COUNT_SWR_KEY
          : Array.isArray(key) && key[0] === MY_NOTIFICATIONS_SWR_KEY
      );
    } catch (err) {
      const e = err instanceof Error ? err : new Error("全既読処理に失敗しました。");
      setError(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [mutate]);

  return { markAllAsRead: handleMarkAllAsRead, isLoading, error };
}
