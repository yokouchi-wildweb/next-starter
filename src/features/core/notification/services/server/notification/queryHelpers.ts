// src/features/core/notification/services/server/notification/queryHelpers.ts
// ユーザー向け通知クエリの共通 WHERE 条件

import { sql, isNull, type SQL } from "drizzle-orm";
import { NotificationTable } from "@/features/core/notification/entities/drizzle";
import { NotificationReadTable } from "@/features/core/notification/entities/notificationRead";

/**
 * ユーザーに該当するお知らせの WHERE 条件を生成する。
 * - published_at <= now()（公開済み）
 * - target_type = 'all' OR ロール一致 OR userId 一致
 */
export function buildMyNotificationsWhere(
  userId: string,
  userRole: string
): SQL {
  return sql`
    ${NotificationTable.published_at} <= now()
    AND (
      ${NotificationTable.target_type} = 'all'
      OR (${NotificationTable.target_type} = 'role' AND ${userRole} = ANY(${NotificationTable.target_roles}))
      OR (${NotificationTable.target_type} = 'individual' AND ${userId} = ANY(${NotificationTable.target_user_ids}))
    )
  `;
}

/**
 * 「未読」として扱うための追加条件群を返す。
 * NotificationReadTable を LEFT JOIN している前提で使用する。
 *
 * 「未読」の単一定義: read_at が存在しない AND サイレントでない
 * この定義を変更するときは必ずここを更新する（getMyNotifications/Count/Page 全てに反映される）。
 */
export function buildUnreadOnlyConditions(): SQL[] {
  return [
    isNull(NotificationReadTable.readAt),
    sql`${NotificationTable.is_silent} = false`,
  ];
}
