// src/features/core/notification/services/server/notification/queryHelpers.ts
// ユーザー向け通知クエリの共通 WHERE 条件

import { sql, type SQL } from "drizzle-orm";
import { NotificationTable } from "@/features/core/notification/entities/drizzle";

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
