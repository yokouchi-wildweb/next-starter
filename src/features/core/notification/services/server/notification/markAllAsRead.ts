// src/features/core/notification/services/server/notification/markAllAsRead.ts
// 全既読マーク

import { and, isNull } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { NotificationTable } from "@/features/core/notification/entities/drizzle";
import { NotificationReadTable } from "@/features/core/notification/entities/notificationRead";

import { buildVisibilityWhere } from "./queryHelpers";
import { readStateJoinOn } from "./readState";
import type { NotificationViewer } from "./viewer";

export async function markAllAsRead(viewer: NotificationViewer): Promise<void> {
  const { userId } = viewer;
  // 自分宛の未読通知IDを取得して一括 insert
  const unreadNotifications = await db
    .select({
      id: NotificationTable.id,
    })
    .from(NotificationTable)
    .leftJoin(NotificationReadTable, readStateJoinOn(viewer))
    .where(and(buildVisibilityWhere(viewer), isNull(NotificationReadTable.readAt)));

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
