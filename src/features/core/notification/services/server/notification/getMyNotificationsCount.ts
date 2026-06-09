// src/features/core/notification/services/server/notification/getMyNotificationsCount.ts
// ユーザー向けお知らせ総件数取得（無限スクロールの hasMore 判定や、未読バッジ等に使用）

import { sql, and } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { NotificationTable } from "@/features/core/notification/entities/drizzle";
import { NotificationReadTable } from "@/features/core/notification/entities/notificationRead";

import { buildVisibilityWhere } from "./queryHelpers";
import { readStateJoinOn, unreadConditions } from "./readState";
import type { NotificationViewer } from "./viewer";

type GetMyNotificationsCountOptions = {
  /** true: 未読のみカウント。false（デフォルト）: 該当ユーザーの全通知をカウント */
  unreadOnly?: boolean;
};

/**
 * ユーザーに該当するお知らせの総件数を返す。
 *
 * - `unreadOnly: false`（デフォルト）: notification_reads を JOIN しないため、
 *   NotificationTable のインデックスのみで完結する軽量クエリ。
 * - `unreadOnly: true`: getUnreadCount と同等の挙動（共通ヘルパー使用）。
 *
 * 「次ページがあるか」判定には getMyNotificationsPage を推奨（1 クエリで items+total
 * を原子的に取得でき race condition がない）。本メソッドはバッジ表示など
 * 件数のみが必要な場面で使用する。
 */
export async function getMyNotificationsCount(
  viewer: NotificationViewer,
  options: GetMyNotificationsCountOptions = {}
): Promise<number> {
  const { unreadOnly = false } = options;
  const whereCondition = buildVisibilityWhere(viewer);

  if (!unreadOnly) {
    // JOIN 省略: 単純な COUNT(*) で済むため最も軽量
    const [result] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(NotificationTable)
      .where(whereCondition);

    return result?.count ?? 0;
  }

  const [result] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(NotificationTable)
    .leftJoin(NotificationReadTable, readStateJoinOn(viewer))
    .where(and(whereCondition, ...unreadConditions()));

  return result?.count ?? 0;
}
