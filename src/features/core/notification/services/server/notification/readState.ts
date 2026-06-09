// src/features/core/notification/services/server/notification/readState.ts
// 「既読」というドメイン関心の単一の集約点。
//
// 既読は2系統のハイブリッド:
//   1. 個別既読  … notification_reads の行（通知1件ごと）
//   2. ウォーターマーク … notification_read_states.read_watermark_at
//      （この時刻以前に公開された通知は既読扱い。全既読を O(1) で表現）
// 「既読か」「readAt 何時か」は本モジュールだけが両系統を知る。クエリ各所
// (getMyNotifications / Page / Count) は viewer を渡してここを呼ぶだけで、
// watermark / 個別行のどちらで既読になっているかを意識しない。
// 既読セマンティクスを変更するときは、このモジュールだけを変更すればよい。

import { sql, and, isNull, type SQL } from "drizzle-orm";
import { NotificationTable } from "@/features/core/notification/entities/drizzle";
import { NotificationReadTable } from "@/features/core/notification/entities/notificationRead";
import { NotificationReadStateTable } from "@/features/core/notification/entities/notificationReadState";
import type { NotificationViewer } from "./viewer";

/**
 * 閲覧者の既読ウォーターマーク時刻を引く相関のないスカラサブクエリ。
 * userId は定数なので PG では InitPlan として1回だけ評価される（行ごとのコストなし）。
 * 未設定（行なし）の場合は NULL を返す。
 */
function watermarkSubquery(viewer: NotificationViewer): SQL {
  return sql`(SELECT ${NotificationReadStateTable.readWatermarkAt} FROM ${NotificationReadStateTable} WHERE ${NotificationReadStateTable.userId} = ${viewer.userId})`;
}

/**
 * 通知に対する閲覧者の「個別既読」を解決するための LEFT JOIN 条件。
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
 * - サイレント通知は published_at（既読扱い）
 * - published_at <= ウォーターマーク なら watermark 時刻（全既読でまとめて既読化）
 * - いずれでもなければ NULL（未読）
 * readStateJoinOn で notification_reads を結合している前提。
 */
export function effectiveReadAtExpr(viewer: NotificationViewer): SQL<Date | null> {
  const watermark = watermarkSubquery(viewer);
  return sql<Date | null>`COALESCE(
    ${NotificationReadTable.readAt},
    CASE WHEN ${NotificationTable.is_silent} THEN ${NotificationTable.published_at} END,
    CASE WHEN ${NotificationTable.published_at} <= ${watermark} THEN ${watermark} END
  )`;
}

/**
 * 「未読」の単一定義。readStateJoinOn で結合している前提で使う追加 WHERE 条件群。
 * 現在の定義: 個別既読が無い AND サイレントでない AND ウォーターマーク以降に公開された。
 * watermark が NULL の場合に全件既読となる罠を COALESCE('-infinity') で回避する。
 * この定義を変更するときは必ずここを更新する（未読フィルタ・未読カウント全てに反映される）。
 */
export function unreadConditions(viewer: NotificationViewer): SQL[] {
  return [
    isNull(NotificationReadTable.readAt),
    sql`${NotificationTable.is_silent} = false`,
    sql`${NotificationTable.published_at} > COALESCE(${watermarkSubquery(viewer)}, '-infinity'::timestamptz)`,
  ];
}
