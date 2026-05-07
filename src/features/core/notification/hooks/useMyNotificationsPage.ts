// src/features/core/notification/hooks/useMyNotificationsPage.ts
// 自分宛通知のページ取得フック: items + total + hasMore を 1 リクエストで取得
//
// 無限スクロール / ページネーション UI の推奨パス。
// items と total が同一トランザクションで返るため race condition がない。

"use client";

import useSWR from "swr";
import {
  getMyNotificationsPage,
  type MyNotificationsPage,
} from "../services/client/userNotificationClient";

const SWR_KEY = "/api/notification/my/page";

type UseMyNotificationsPageOptions = {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
};

type UseMyNotificationsPageReturn = {
  page: MyNotificationsPage | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => void;
};

export function useMyNotificationsPage(
  options: UseMyNotificationsPageOptions = {}
): UseMyNotificationsPageReturn {
  const { data, error, isLoading, mutate } = useSWR(
    [SWR_KEY, options],
    async () => getMyNotificationsPage(options)
  );

  return {
    page: data,
    isLoading,
    error,
    mutate: () => mutate(),
  };
}

export const MY_NOTIFICATIONS_PAGE_SWR_KEY = SWR_KEY;
