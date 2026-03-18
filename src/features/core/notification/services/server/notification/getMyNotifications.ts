// src/features/core/notification/services/server/notification/getMyNotifications.ts
// ユーザー向けお知らせ一覧取得

import { sql, and, isNull } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { NotificationTable } from "@/features/core/notification/entities/drizzle";
import { NotificationReadTable } from "@/features/core/notification/entities/notificationRead";

import { buildMyNotificationsWhere } from "./queryHelpers";

export type MyNotification = {
  id: string;
  title: string | null;
  body: string;
  image: string | null;
  senderType: "admin" | "system";
  metadata: Record<string, unknown> | null;
  isSilent: boolean;
  publishedAt: Date;
  readAt: Date | null;
};

type GetMyNotificationsOptions = {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
};

export async function getMyNotifications(
  userId: string,
  userRole: string,
  options: GetMyNotificationsOptions = {}
): Promise<MyNotification[]> {
  const { limit = 50, offset = 0, unreadOnly = false } = options;

  const whereCondition = buildMyNotificationsWhere(userId, userRole);

  const conditions = [whereCondition];
  if (unreadOnly) {
    conditions.push(isNull(NotificationReadTable.readAt));
    conditions.push(sql`${NotificationTable.is_silent} = false`);
  }

  const rows = await db
    .select({
      id: NotificationTable.id,
      title: NotificationTable.title,
      body: NotificationTable.body,
      image: NotificationTable.image,
      senderType: NotificationTable.sender_type,
      metadata: NotificationTable.metadata,
      isSilent: NotificationTable.is_silent,
      publishedAt: NotificationTable.published_at,
      readAt: sql<Date | null>`COALESCE(${NotificationReadTable.readAt}, CASE WHEN ${NotificationTable.is_silent} THEN ${NotificationTable.published_at} ELSE NULL END)`,
    })
    .from(NotificationTable)
    .leftJoin(
      NotificationReadTable,
      and(
        sql`${NotificationReadTable.notificationId} = ${NotificationTable.id}`,
        sql`${NotificationReadTable.userId} = ${userId}`
      )
    )
    .where(and(...conditions))
    .orderBy(sql`${NotificationTable.published_at} DESC`)
    .limit(limit)
    .offset(offset);

  return rows;
}
