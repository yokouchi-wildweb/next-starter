// src/features/core/notification/services/server/notification/queryHelpers.ts
// ユーザー向け通知クエリの共通 WHERE 条件

import { sql, isNull, type SQL } from "drizzle-orm";
import { NotificationTable } from "@/features/core/notification/entities/drizzle";
import { NotificationReadTable } from "@/features/core/notification/entities/notificationRead";
import { UserTable } from "@/features/core/user/entities/drizzle";
import type { NotificationViewer } from "./viewer";

/**
 * 閲覧者に該当するお知らせの「可視性」WHERE 条件を生成する。
 * 通知の可視性ルールはこの関数に集約されており、ユーザー向けクエリ
 * (getMyNotifications / Page / Count / markAllAsRead) はすべてこれを通る。
 * ルールを追加・変更するときは必ずここを更新する（全消費者へ一貫して反映される）。
 *
 * 現在のルール:
 * - published_at <= now()（公開済み）
 * - published_at >= 閲覧者の登録日時（user.created_at）— 登録日以前の通知は閲覧不可。
 *   新規ユーザーに過去の全体配信が見えてしまう問題への対策（アクセス制御）。
 *   相関のないサブクエリ（userId は定数）なので PG では1回だけ評価される。
 *   created_at が NULL / ユーザー行が存在しない場合は比較結果が NULL となり全件除外＝fail-closed。
 * - target_type = 'all' OR ロール一致 OR userId 一致
 */
export function buildVisibilityWhere(viewer: NotificationViewer): SQL {
  return sql`
    ${NotificationTable.published_at} <= now()
    AND ${NotificationTable.published_at} >= (
      SELECT ${UserTable.createdAt} FROM ${UserTable}
      WHERE ${UserTable.id} = ${viewer.userId}
    )
    AND (
      ${NotificationTable.target_type} = 'all'
      OR (${NotificationTable.target_type} = 'role' AND ${viewer.role} = ANY(${NotificationTable.target_roles}))
      OR (${NotificationTable.target_type} = 'individual' AND ${viewer.userId} = ANY(${NotificationTable.target_user_ids}))
    )
  `;
}

/**
 * 「未読」として扱うための追加条件群を返す。
 * NotificationReadTable を LEFT JOIN している前提で使用する。
 *
 * 「未読」の単一定義: read_at が存在しない AND サイレントでない
 * この定義を変更するときは必ずここを更新する（getMyNotifications/Count/Page 全てに反映される）。
 */
export function buildUnreadOnlyConditions(): SQL[] {
  return [
    isNull(NotificationReadTable.readAt),
    sql`${NotificationTable.is_silent} = false`,
  ];
}
