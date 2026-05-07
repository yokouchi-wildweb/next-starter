// src/features/core/notification/hooks/useMyNotificationsCount.ts
// 自分宛通知の総件数取得フック（バッジ表示や件数のみが必要な場面用）
//
// 無限スクロールの hasMore 判定には useMyNotificationsPage を推奨。
// items 取得との race condition を避けるため、件数と一覧を別キャッシュで持つと
// 整合性が崩れる可能性があるが、ページ取得 API は 1 リクエストで原子的に解決する。

"use client";

import useSWR from "swr";
import { getMyNotificationsCount } from "../services/client/userNotificationClient";

const SWR_KEY = "/api/notification/my/count";

type UseMyNotificationsCountOptions = {
  /** true で未読のみカウント。省略時は false（全件） */
  unreadOnly?: boolean;
};

type UseMyNotificationsCountReturn = {
  count: number | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => void;
};

export function useMyNotificationsCount(
  options: UseMyNotificationsCountOptions = {}
): UseMyNotificationsCountReturn {
  const { data, error, isLoading, mutate } = useSWR(
    [SWR_KEY, options],
    async () => getMyNotificationsCount(options)
  );

  return {
    count: data,
    isLoading,
    error,
    mutate: () => mutate(),
  };
}

export const MY_NOTIFICATIONS_COUNT_SWR_KEY = SWR_KEY;
