// src/features/core/notification/hooks/useMyNotificationsPage.ts
// 自分宛通知の無限スクロール用フック（keyset ページネーション）
//
// useSWRInfinite で前ページの nextCursor を辿りながら順次ページを取得する。
// items は全ページを flatten して返す。loadMore() で次ページを追加読み込み。

"use client";

import useSWRInfinite from "swr/infinite";
import {
  getMyNotificationsPage,
  type MyNotification,
  type MyNotificationsPage,
} from "../services/client/userNotificationClient";

const SWR_KEY = "/api/notification/my/page";

const DEFAULT_LIMIT = 50;

type UseMyNotificationsPageOptions = {
  limit?: number;
  unreadOnly?: boolean;
};

type UseMyNotificationsPageReturn = {
  /** 取得済み全ページを flatten した通知一覧 */
  items: MyNotification[];
  /** 次ページが存在するか */
  hasMore: boolean;
  /** 初回ロード中か */
  isLoading: boolean;
  /** 追加ページ取得中か */
  isLoadingMore: boolean;
  error: Error | undefined;
  /** 次ページを追加読み込みする */
  loadMore: () => void;
  /** 全ページを再検証する */
  mutate: () => void;
};

// SWRInfinite のキー。先頭要素を SWR_KEY 文字列にしておくことで、
// 既読系フックの mutate マッチャ（配列キーの head 一致）でキャッシュ更新される。
type PageKey = [key: string, unreadOnly: boolean, limit: number, cursor: string | null];

export function useMyNotificationsPage(
  options: UseMyNotificationsPageOptions = {}
): UseMyNotificationsPageReturn {
  const { limit = DEFAULT_LIMIT, unreadOnly = false } = options;

  const getKey = (
    pageIndex: number,
    previousPageData: MyNotificationsPage | null
  ): PageKey | null => {
    // 前ページが「次なし」なら終了
    if (previousPageData && !previousPageData.hasMore) return null;
    const cursor = pageIndex === 0 ? null : (previousPageData?.nextCursor ?? null);
    return [SWR_KEY, unreadOnly, limit, cursor];
  };

  const { data, error, size, setSize, isLoading, mutate } = useSWRInfinite(
    getKey,
    ([, unread, lim, cursor]: PageKey) =>
      getMyNotificationsPage({ limit: lim, unreadOnly: unread, cursor })
  );

  const items = data ? data.flatMap((p) => p.items) : [];
  const lastPage = data?.[data.length - 1];
  const hasMore = lastPage ? lastPage.hasMore : false;
  const isLoadingMore =
    size > 0 && !!data && typeof data[size - 1] === "undefined";

  return {
    items,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    loadMore: () => setSize(size + 1),
    mutate: () => mutate(),
  };
}

export const MY_NOTIFICATIONS_PAGE_SWR_KEY = SWR_KEY;
