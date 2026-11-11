// src/features/core/messaging/services/server/inbox/readState.ts
//
// 既読の判定: 個別の既読の行(message_inbox_reads)がある か、公開の時刻 ≤ 全部既読の時刻(read_watermark_at)。
// 全部既読は watermark を今に進め、同じ取引で自分の個別の既読の行を掃く(watermark が覆うので消しても既読のまま)。
// 静かな行(metadata.silent = true。前のお知らせの is_silent を写した行)は未読の数と未読だけの一覧(未読のモーダル)に入れない。一覧には出す。

import { sql, type SQL } from "drizzle-orm";

import { MessageInboxItemTable, MessageInboxReadStateTable, MessageInboxReadTable } from "../../../entities/inbox";

/** 既読か(boolean の式) */
export function inboxReadSql(userId: string): SQL<boolean> {
  const I = MessageInboxItemTable;
  const R = MessageInboxReadTable;
  const S = MessageInboxReadStateTable;
  return sql<boolean>`(
    EXISTS (SELECT 1 FROM ${R} WHERE ${R.item_id} = ${I.id} AND ${R.user_id} = ${userId})
    OR ${I.published_at} <= COALESCE(
      (SELECT ${S.read_watermark_at} FROM ${S} WHERE ${S.user_id} = ${userId}),
      '-infinity'::timestamptz
    )
  )`;
}

/** 規則の写し(単体テスト) */
export function isRead(params: { hasReadRow: boolean; publishedAt: Date; watermark: Date | null }): boolean {
  return params.hasReadRow || (params.watermark !== null && params.publishedAt <= params.watermark);
}

/** 静かな行か(boolean の式。metadata.silent = true) */
export function inboxSilentSql(): SQL<boolean> {
  return sql<boolean>`COALESCE(${MessageInboxItemTable.metadata} @> '{"silent": true}'::jsonb, false)`;
}

/** 規則の写し(単体テスト) */
export function isSilent(metadata: Record<string, unknown> | null): boolean {
  return metadata?.silent === true;
}
