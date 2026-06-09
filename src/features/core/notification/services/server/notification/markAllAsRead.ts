// src/features/core/notification/services/server/notification/markAllAsRead.ts
// 全既読マーク（ウォーターマーク方式・O(1)）
//
// 「未読を1件ずつ既読行に INSERT」する代わりに、ユーザーの既読ウォーターマークを
// now() に更新する（1行 upsert）。これで未読件数に依らず O(1) で全既読になる。
// あわせて watermark 以前の個別既読行は冗長になるため同一トランザクションで prune し、
// notification_reads の増殖を抑制する。
//
// prune の安全性: 可視通知は必ず published_at <= now() なので、個別既読された通知は
// published_at <= now() = watermark を満たす。よって prune 後も watermark 経由で
// 既読として扱われ、既読状態は失われない。

import { sql, and, eq, lte } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { NotificationReadTable } from "@/features/core/notification/entities/notificationRead";
import { NotificationReadStateTable } from "@/features/core/notification/entities/notificationReadState";

import type { NotificationViewer } from "./viewer";

export async function markAllAsRead(viewer: NotificationViewer): Promise<void> {
  const { userId } = viewer;

  await db.transaction(async (tx) => {
    // 全既読の基準時刻を now() に更新（トランザクション開始時刻で一貫）
    await tx
      .insert(NotificationReadStateTable)
      .values({ userId, readWatermarkAt: sql`now()`, updatedAt: sql`now()` })
      .onConflictDoUpdate({
        target: NotificationReadStateTable.userId,
        set: { readWatermarkAt: sql`now()`, updatedAt: sql`now()` },
      });

    // watermark 以前の個別既読行を prune（watermark でカバーされるため冗長）
    await tx
      .delete(NotificationReadTable)
      .where(
        and(
          eq(NotificationReadTable.userId, userId),
          lte(NotificationReadTable.readAt, sql`now()`)
        )
      );
  });
}
