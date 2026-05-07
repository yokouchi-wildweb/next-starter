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
  total: number;
  hasMore: boolean;
};

type GetMyNotificationsPageParams = {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
};

/**
 * 自分宛通知の items + total + hasMore を 1 リクエストで取得する。
 * 無限スクロール / ページネーション UI の推奨パス。
 */
export async function getMyNotificationsPage(
  params: GetMyNotificationsPageParams = {}
): Promise<MyNotificationsPage> {
  try {
    const searchParams = new URLSearchParams();
    if (params.limit != null) searchParams.set("limit", String(params.limit));
    if (params.offset != null) searchParams.set("offset", String(params.offset));
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
