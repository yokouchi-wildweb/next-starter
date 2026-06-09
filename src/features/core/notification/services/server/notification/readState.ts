// src/features/core/notification/services/server/notification/readState.ts
// 「既読」というドメイン関心の単一の集約点。
//
// 既読の出どころ（現状: notification_reads の個別既読行）・未読判定・readAt 表示値を
// すべてこのモジュールに閉じ込める。ユーザー向けクエリ
// (getMyNotifications / Page / Count / markAllAsRead) は、ここを通じてのみ既読状態に触れる。
// 既読のセマンティクスを変更するとき（例: 既読ウォーターマークの導入）は、
// このモジュールだけを変更すればよい（クエリ各所へロジックを散らさない）。

import { sql, and, isNull, type SQL } from "drizzle-orm";
import { NotificationTable } from "@/features/core/notification/entities/drizzle";
import { NotificationReadTable } from "@/features/core/notification/entities/notificationRead";
import type { NotificationViewer } from "./viewer";

/**
 * 通知に対する閲覧者の既読状態を解決するための LEFT JOIN 条件。
 * `.leftJoin(NotificationReadTable, readStateJoinOn(viewer))` の形で使用する前提。
 */
export function readStateJoinOn(viewer: NotificationViewer): SQL | undefined {
  return and(
    sql`${NotificationReadTable.notificationId} = ${NotificationTable.id}`,
    sql`${NotificationReadTable.userId} = ${viewer.userId}`
  );
}

/**
 * readAt として表示する実効値。
 * - 個別既読行があればその read_at
 * - 無ければサイレント通知は published_at（既読扱い）
 * - それ以外は NULL（未読）
 * readStateJoinOn で notification_reads を結合している前提。
 */
export function effectiveReadAtExpr(): SQL<Date | null> {
  return sql<Date | null>`COALESCE(${NotificationReadTable.readAt}, CASE WHEN ${NotificationTable.is_silent} THEN ${NotificationTable.published_at} ELSE NULL END)`;
}

/**
 * 「未読」の単一定義。readStateJoinOn で結合している前提で使う追加 WHERE 条件群。
 * 現在の定義: 個別既読が無い AND サイレントでない。
 * この定義を変更するときは必ずここを更新する（未読フィルタ・未読カウント全てに反映される）。
 */
export function unreadConditions(): SQL[] {
  return [
    isNull(NotificationReadTable.readAt),
    sql`${NotificationTable.is_silent} = false`,
  ];
}
