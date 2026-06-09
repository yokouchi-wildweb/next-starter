// src/features/core/notification/services/server/notification/getMyNotificationsPage.ts
// ユーザー向けお知らせの「ページ取得」: items + total + hasMore を 1 クエリで原子的に返す
//
// 大規模運用での無限スクロール / ページネーション UI 推奨パス。
// items 取得と件数取得を別クエリにすると、その間に新着通知が入った場合に
// hasMore 判定がズレて重複表示や読み飛ばしが発生する。本実装は
// COUNT(*) OVER() ウィンドウ関数で同一トランザクション内に計算する。

import { sql, and } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { NotificationTable } from "@/features/core/notification/entities/drizzle";
import { NotificationReadTable } from "@/features/core/notification/entities/notificationRead";

import {
  buildVisibilityWhere,
  buildUnreadOnlyConditions,
} from "./queryHelpers";
import type { MyNotification } from "./getMyNotifications";
import type { NotificationViewer } from "./viewer";

type GetMyNotificationsPageOptions = {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
};

export type MyNotificationsPage = {
  /** このページの通知一覧（published_at DESC 順） */
  items: MyNotification[];
  /** WHERE 条件にマッチする全件数（フィルタ後・ページ前） */
  total: number;
  /** offset + items.length < total（次ページが存在するか） */
  hasMore: boolean;
};

const DEFAULT_LIMIT = 50;
const DEFAULT_OFFSET = 0;

export async function getMyNotificationsPage(
  viewer: NotificationViewer,
  options: GetMyNotificationsPageOptions = {}
): Promise<MyNotificationsPage> {
  const {
    limit = DEFAULT_LIMIT,
    offset = DEFAULT_OFFSET,
    unreadOnly = false,
  } = options;
  const { userId } = viewer;

  const whereCondition = buildVisibilityWhere(viewer);
  const conditions = [whereCondition];
  if (unreadOnly) {
    conditions.push(...buildUnreadOnlyConditions());
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
      total: sql<number>`COUNT(*) OVER()::int`,
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

  // 結果が空のとき COUNT(*) OVER() は値を返さないため、別クエリで total=0 を確定させる必要はないが、
  // offset 過大などで「該当はあるが行が返らない」ケースもあり得るため、空のときのみ別途 COUNT を取得する。
  let total: number;
  if (rows.length > 0) {
    total = rows[0].total;
  } else {
    const [countResult] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(NotificationTable)
      .leftJoin(
        NotificationReadTable,
        and(
          sql`${NotificationReadTable.notificationId} = ${NotificationTable.id}`,
          sql`${NotificationReadTable.userId} = ${userId}`
        )
      )
      .where(and(...conditions));
    total = countResult?.count ?? 0;
  }

  // total を除いた items を返す
  const items: MyNotification[] = rows.map(({ total: _total, ...rest }) => rest);

  return {
    items,
    total,
    hasMore: offset + items.length < total,
  };
}
