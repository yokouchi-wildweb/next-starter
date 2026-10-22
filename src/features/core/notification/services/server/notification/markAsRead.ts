// src/features/core/notification/services/server/notification/markAsRead.ts
// 個別既読マーク

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors";
import { NotificationTable } from "@/features/core/notification/entities/drizzle";
import { NotificationReadTable } from "@/features/core/notification/entities/notificationRead";

import { buildVisibilityWhere } from "./queryHelpers";
import type { NotificationViewer } from "./viewer";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 閲覧者に見えている通知を既読にする。
 *
 * 可視性は一覧・件数と同じ buildVisibilityWhere で判定する。見えない通知（他人宛て個別・
 * 別ロール宛て・登録前・未公開）と存在しない通知はどちらも 404 にする（存在の探りを防ぐ）。
 * 判定しないと、他人宛て通知の既読行を作れて管理画面の既読数・既読者一覧が汚れる。
 */
export async function markAsRead(
  notificationId: string,
  viewer: NotificationViewer
): Promise<void> {
  // uuid 列なので形式外の値は DB エラー（500）になる前に「見つからない」と同じ扱いにする
  if (!UUID_PATTERN.test(notificationId)) {
    throw new DomainError("お知らせが見つかりません", { status: 404 });
  }

  const [visible] = await db
    .select({ id: NotificationTable.id })
    .from(NotificationTable)
    .where(and(eq(NotificationTable.id, notificationId), buildVisibilityWhere(viewer)))
    .limit(1);

  if (!visible) {
    throw new DomainError("お知らせが見つかりません", { status: 404 });
  }

  // ON CONFLICT で既に既読の場合は何もしない
  await db
    .insert(NotificationReadTable)
    .values({
      notificationId,
      userId: viewer.userId,
    })
    .onConflictDoNothing();
}
