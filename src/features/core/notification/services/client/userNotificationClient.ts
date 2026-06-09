// src/features/core/notification/services/client/userNotificationClient.ts
// ユーザー向けお知らせ取得・既読操作のクライアントサービス

import axios from "axios";
import { normalizeHttpError } from "@/lib/errors";

export type MyNotification = {
  id: string;
  title: string | null;
  body: string;
  image: string | null;
  senderType: "admin" | "system";
  metadata: Record<string, unknown> | null;
  publishedAt: string;
  readAt: string | null;
};

type GetMyNotificationsParams = {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
};

export async function getMyNotifications(
  params: GetMyNotificationsParams = {}
): Promise<MyNotification[]> {
  try {
    const searchParams = new URLSearchParams();
    if (params.limit != null) searchParams.set("limit", String(params.limit));
    if (params.offset != null) searchParams.set("offset", String(params.offset));
    if (params.unreadOnly) searchParams.set("unreadOnly", "true");

    const query = searchParams.toString();
    const url = `/api/notification/my${query ? `?${query}` : ""}`;
    const { data } = await axios.get<MyNotification[]>(url);
    return data;
  } catch (error) {
    throw normalizeHttpError(error);
  }
}

export async function getUnreadCount(): Promise<number> {
  try {
    const { data } = await axios.get<{ count: number }>("/api/notification/my/unread-count");
    return data.count;
  } catch (error) {
    throw normalizeHttpError(error);
  }
}

type GetMyNotificationsCountParams = {
  /** true で未読のみカウント。省略時は false（全件） */
  unreadOnly?: boolean;
};

/**
 * 自分宛通知の総件数を取得する。
 * バッジ表示や、件数のみ必要な場面で使用。無限スクロールの hasMore 判定には
 * getMyNotificationsPage を推奨（race condition がない）。
 */
export async function getMyNotificationsCount(
  params: GetMyNotificationsCountParams = {}
): Promise<number> {
  try {
    const searchParams = new URLSearchParams();
    if (params.unreadOnly) searchParams.set("unreadOnly", "true");
    const query = searchParams.toString();
    const url = `/api/notification/my/count${query ? `?${query}` : ""}`;
    const { data } = await axios.get<{ count: number }>(url);
    return data.count;
  } catch (error) {
    throw normalizeHttpError(error);
  }
}

export type MyNotificationsPage = {
  items: MyNotification[];
  hasMore: boolean;
  /** 次ページ取得に渡す不透明カーソル。hasMore=false のとき null */
  nextCursor: string | null;
};

type GetMyNotificationsPageParams = {
  limit?: number;
  /** 前ページの nextCursor。未指定で先頭から取得 */
  cursor?: string | null;
  unreadOnly?: boolean;
};

/**
 * 自分宛通知を keyset ページネーションで取得する（無限スクロール推奨パス）。
 * total は返さない（件数が必要なら getMyNotificationsCount を併用）。
 */
export async function getMyNotificationsPage(
  params: GetMyNotificationsPageParams = {}
): Promise<MyNotificationsPage> {
  try {
    const searchParams = new URLSearchParams();
    if (params.limit != null) searchParams.set("limit", String(params.limit));
    if (params.cursor) searchParams.set("cursor", params.cursor);
    if (params.unreadOnly) searchParams.set("unreadOnly", "true");

    const query = searchParams.toString();
    const url = `/api/notification/my/page${query ? `?${query}` : ""}`;
    const { data } = await axios.get<MyNotificationsPage>(url);
    return data;
  } catch (error) {
    throw normalizeHttpError(error);
  }
}

export async function markAsRead(notificationId: string): Promise<void> {
  try {
    await axios.post(`/api/notification/${notificationId}/read`);
  } catch (error) {
    throw normalizeHttpError(error);
  }
}

export async function markAllAsRead(): Promise<void> {
  try {
    await axios.post("/api/notification/read-all");
  } catch (error) {
    throw normalizeHttpError(error);
  }
}

// --- 管理者向け ---

export type SendNotificationInput = {
  title?: string | null;
  body: string;
  image?: string | null;
  targetType: "all" | "role" | "individual";
  targetUserIds?: string[] | null;
  targetRoles?: string[] | null;
  publishedAt?: string | null;
};

export async function sendNotification(input: SendNotificationInput): Promise<void> {
  try {
    await axios.post("/api/notification/send", input);
  } catch (error) {
    throw normalizeHttpError(error);
  }
}
