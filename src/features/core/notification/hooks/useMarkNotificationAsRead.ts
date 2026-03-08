// src/features/core/notification/hooks/useMarkNotificationAsRead.ts
// 個別既読マークフック

"use client";

import { useState, useCallback } from "react";
import { useSWRConfig } from "swr";
import { markAsRead } from "../services/client/userNotificationClient";
import { MY_NOTIFICATIONS_SWR_KEY } from "./useMyNotifications";
import { UNREAD_NOTIFICATION_COUNT_SWR_KEY } from "./useUnreadNotificationCount";

type UseMarkNotificationAsReadReturn = {
  markAsRead: (notificationId: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
};

export function useMarkNotificationAsRead(): UseMarkNotificationAsReadReturn {
  const { mutate } = useSWRConfig();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleMarkAsRead = useCallback(
    async (notificationId: string) => {
      setIsLoading(true);
      setError(null);

      try {
        await markAsRead(notificationId);
        // 一覧と未読数のキャッシュを更新
        mutate((key: unknown) =>
          typeof key === "string"
            ? key.startsWith(MY_NOTIFICATIONS_SWR_KEY) || key === UNREAD_NOTIFICATION_COUNT_SWR_KEY
            : Array.isArray(key) && key[0] === MY_NOTIFICATIONS_SWR_KEY
        );
      } catch (err) {
        const e = err instanceof Error ? err : new Error("既読処理に失敗しました。");
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [mutate]
  );

  return { markAsRead: handleMarkAsRead, isLoading, error };
}
