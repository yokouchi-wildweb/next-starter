// src/features/core/notification/services/server/notification/getUnreadCount.ts
// 未読数取得

import { sql, and, isNull } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { NotificationTable } from "@/features/core/notification/entities/drizzle";
import { NotificationReadTable } from "@/features/core/notification/entities/notificationRead";

import { buildMyNotificationsWhere } from "./queryHelpers";

export async function getUnreadCount(
  userId: string,
  userRole: string
): Promise<number> {
  const whereCondition = buildMyNotificationsWhere(userId, userRole);

  const [result] = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(NotificationTable)
    .leftJoin(
      NotificationReadTable,
      and(
        sql`${NotificationReadTable.notificationId} = ${NotificationTable.id}`,
        sql`${NotificationReadTable.userId} = ${userId}`
      )
    )
    .where(and(whereCondition, isNull(NotificationReadTable.readAt)));

  return result?.count ?? 0;
}
