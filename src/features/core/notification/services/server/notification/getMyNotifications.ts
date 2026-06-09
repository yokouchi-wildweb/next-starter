// src/features/core/notification/services/server/notification/getMyNotifications.ts
// ユーザー向けお知らせ一覧取得

import { sql, and } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { NotificationTable } from "@/features/core/notification/entities/drizzle";
import { NotificationReadTable } from "@/features/core/notification/entities/notificationRead";

import { buildVisibilityWhere } from "./queryHelpers";
import {
  readStateJoinOn,
  effectiveReadAtExpr,
  unreadConditions,
} from "./readState";
import type { NotificationViewer } from "./viewer";

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
  viewer: NotificationViewer,
  options: GetMyNotificationsOptions = {}
): Promise<MyNotification[]> {
  const { limit = 50, offset = 0, unreadOnly = false } = options;

  const conditions = [buildVisibilityWhere(viewer)];
  if (unreadOnly) {
    conditions.push(...unreadConditions());
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
      readAt: effectiveReadAtExpr(),
    })
    .from(NotificationTable)
    .leftJoin(NotificationReadTable, readStateJoinOn(viewer))
    .where(and(...conditions))
    .orderBy(sql`${NotificationTable.published_at} DESC`)
    .limit(limit)
    .offset(offset);

  return rows;
}
