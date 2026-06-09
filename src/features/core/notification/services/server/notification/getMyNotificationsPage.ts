// src/features/core/notification/services/server/notification/getMyNotificationsPage.ts
// ユーザー向けお知らせの「ページ取得」: keyset(cursor) ページネーション
//
// 大規模運用での無限スクロール推奨パス。OFFSET 方式は深いページで O(offset) の
// コストがかかるため、(published_at, id) の複合カーソルで O(page) に保つ。
// 並び順は published_at DESC, id DESC（同時刻配信のタイブレークに id を使い安定化）。
// total は keyset では安価に出せないため返さない（件数が必要なら my/count を併用）。

import { sql, and } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors";
import { NotificationTable } from "@/features/core/notification/entities/drizzle";
import { NotificationReadTable } from "@/features/core/notification/entities/notificationRead";

import { buildVisibilityWhere } from "./queryHelpers";
import {
  readStateJoinOn,
  effectiveReadAtExpr,
  unreadConditions,
} from "./readState";
import type { MyNotification } from "./getMyNotifications";
import type { NotificationViewer } from "./viewer";

type GetMyNotificationsPageOptions = {
  limit?: number;
  /** 前ページの nextCursor。null/未指定で先頭から取得 */
  cursor?: string | null;
  unreadOnly?: boolean;
};

export type MyNotificationsPage = {
  /** このページの通知一覧（published_at DESC, id DESC 順） */
  items: MyNotification[];
  /** 次ページが存在するか */
  hasMore: boolean;
  /** 次ページ取得に渡す不透明カーソル。hasMore=false のとき null */
  nextCursor: string | null;
};

type DecodedCursor = { publishedAt: string; id: string };

const DEFAULT_LIMIT = 50;

/** (publishedAt, id) を不透明な base64url 文字列にエンコード */
function encodeCursor(publishedAt: Date, id: string): string {
  const payload: DecodedCursor = { publishedAt: publishedAt.toISOString(), id };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

/** カーソル文字列をデコード。不正な場合は 400 を投げる */
function decodeCursor(cursor: string): DecodedCursor {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as DecodedCursor;
    if (typeof parsed.publishedAt !== "string" || typeof parsed.id !== "string") {
      throw new Error("missing fields");
    }
    return parsed;
  } catch {
    throw new DomainError("不正なカーソルです。", { status: 400 });
  }
}

export async function getMyNotificationsPage(
  viewer: NotificationViewer,
  options: GetMyNotificationsPageOptions = {}
): Promise<MyNotificationsPage> {
  const { limit = DEFAULT_LIMIT, cursor = null, unreadOnly = false } = options;

  const conditions = [buildVisibilityWhere(viewer)];
  if (unreadOnly) {
    conditions.push(...unreadConditions(viewer));
  }
  if (cursor) {
    const { publishedAt, id } = decodeCursor(cursor);
    // 行値比較: published_at が小さい、または同時刻で id が小さい（= より古い）ものが次ページ
    conditions.push(
      sql`(${NotificationTable.published_at}, ${NotificationTable.id}) < (${publishedAt}::timestamptz, ${id}::uuid)`
    );
  }

  // hasMore 判定のため limit + 1 件取得する
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
      readAt: effectiveReadAtExpr(viewer),
    })
    .from(NotificationTable)
    .leftJoin(NotificationReadTable, readStateJoinOn(viewer))
    .where(and(...conditions))
    .orderBy(sql`${NotificationTable.published_at} DESC`, sql`${NotificationTable.id} DESC`)
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.publishedAt, last.id) : null;

  return { items, hasMore, nextCursor };
}
