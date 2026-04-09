// src/features/notification/services/server/notification/getReadCounts.ts
// 通知IDごとの既読数を取得

import { sql, inArray } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { NotificationReadTable } from "@/features/core/notification/entities/notificationRead";

/**
 * 指定された通知IDリストに対して、それぞれの既読数を返す
 */
export async function getReadCounts(
  notificationIds: string[]
): Promise<Record<string, number>> {
  if (notificationIds.length === 0) return {};

  const rows = await db
    .select({
      notificationId: NotificationReadTable.notificationId,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(NotificationReadTable)
    .where(inArray(NotificationReadTable.notificationId, notificationIds))
    .groupBy(NotificationReadTable.notificationId);

  const map: Record<string, number> = {};
  for (const row of rows) {
    map[row.notificationId] = row.count;
  }
  return map;
}
