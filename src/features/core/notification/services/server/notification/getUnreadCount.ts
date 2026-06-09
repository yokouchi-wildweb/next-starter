// src/features/core/notification/services/server/notification/getUnreadCount.ts
// 未読数取得（getMyNotificationsCount の薄いラッパ。「未読」の定義は queryHelpers.ts に集約）

import { getMyNotificationsCount } from "./getMyNotificationsCount";
import type { NotificationViewer } from "./viewer";

/**
 * 未読通知の件数を返す。
 * 内部的には getMyNotificationsCount({ unreadOnly: true }) と同義。
 * 既存呼び出し側との互換のため残されている。
 */
export async function getUnreadCount(viewer: NotificationViewer): Promise<number> {
  return getMyNotificationsCount(viewer, { unreadOnly: true });
}
