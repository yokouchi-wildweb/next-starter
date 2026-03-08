// src/features/core/notification/services/server/notification/markAsRead.ts
// 個別既読マーク

import { db } from "@/lib/drizzle";
import { NotificationReadTable } from "@/features/core/notification/entities/notificationRead";

export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<void> {
  // ON CONFLICT で既に既読の場合は何もしない
  await db
    .insert(NotificationReadTable)
    .values({
      notificationId,
      userId,
    })
    .onConflictDoNothing();
}
