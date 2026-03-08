// src/features/core/notification/services/server/notification/markAllAsRead.ts
// 全既読マーク

import { sql, and, isNull } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { NotificationTable } from "@/features/core/notification/entities/drizzle";
import { NotificationReadTable } from "@/features/core/notification/entities/notificationRead";

import { buildMyNotificationsWhere } from "./queryHelpers";

export async function markAllAsRead(
  userId: string,
  userRole: string
): Promise<void> {
  // 自分宛の未読通知IDを取得して一括 insert
  const unreadNotifications = await db
    .select({
      id: NotificationTable.id,
    })
    .from(NotificationTable)
    .leftJoin(
      NotificationReadTable,
      and(
        sql`${NotificationReadTable.notificationId} = ${NotificationTable.id}`,
        sql`${NotificationReadTable.userId} = ${userId}`
      )
    )
    .where(and(buildMyNotificationsWhere(userId, userRole), isNull(NotificationReadTable.readAt)));

  if (unreadNotifications.length === 0) return;

  await db
    .insert(NotificationReadTable)
    .values(
      unreadNotifications.map((n) => ({
        notificationId: n.id,
        userId,
      }))
    )
    .onConflictDoNothing();
}
