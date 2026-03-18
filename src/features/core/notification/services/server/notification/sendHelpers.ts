// src/features/core/notification/services/server/notification/sendHelpers.ts
// sendDirect の簡易ラッパー群（senderType: "system" 固定）

import { sendDirect } from "./sendDirect";
import type { Notification } from "@/features/core/notification/entities/model";

/** sendToUser / sendToUsers / sendToRole / sendToAll 共通の入力型 */
export type NotificationContent = {
  title?: string | null;
  body: string;
  image?: string | null;
  metadata?: Record<string, unknown> | null;
  silent?: boolean;
  publishedAt?: Date | null;
};

/** 特定ユーザー1名にシステム通知を送信 */
export async function sendToUser(
  userId: string,
  content: NotificationContent
): Promise<Notification> {
  return sendDirect({
    ...content,
    targetType: "individual",
    targetUserIds: [userId],
    senderType: "system",
  });
}

/** 複数ユーザーにシステム通知を送信 */
export async function sendToUsers(
  userIds: string[],
  content: NotificationContent
): Promise<Notification> {
  return sendDirect({
    ...content,
    targetType: "individual",
    targetUserIds: userIds,
    senderType: "system",
  });
}

/** 指定ロールのユーザーにシステム通知を送信 */
export async function sendToRole(
  roles: string | string[],
  content: NotificationContent
): Promise<Notification> {
  return sendDirect({
    ...content,
    targetType: "role",
    targetRoles: Array.isArray(roles) ? roles : [roles],
    senderType: "system",
  });
}

/** 全ユーザーにシステム通知を送信 */
export async function sendToAll(
  content: NotificationContent
): Promise<Notification> {
  return sendDirect({
    ...content,
    targetType: "all",
    senderType: "system",
  });
}
