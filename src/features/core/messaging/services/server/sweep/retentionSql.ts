// src/features/core/messaging/services/server/sweep/retentionSql.ts
//
// 保持の掃除の生の SQL(store.ts が実行する。db を持たないので検査 rawSqlParams.test.ts が組み立てて値を確かめる)。
// 生の sql`` に JS の Date を渡さない(Postgres が読めず落ちる): ISO の文字列 + ::timestamptz で渡す

import { sql, type SQL } from "drizzle-orm";

/**
 * 古い事件を最大 limit 行消す(SKIP LOCKED の CTE、RETURNING id)。
 * maxSeq = 購読の一番遅い印(購読がある時)。それより新しい事件は日数を過ぎても消さない(まだ渡していない、D47)
 */
export function expiredEventsDeleteSql(cutoff: Date, limit: number, maxSeq: number | null = null): SQL {
  const unread = maxSeq === null ? sql`` : sql` AND seq <= ${maxSeq}`;
  return sql`
    WITH expired AS (
      SELECT id FROM message_events
      WHERE created_at < ${cutoff.toISOString()}::timestamptz${unread}
      ORDER BY created_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    DELETE FROM message_events WHERE id IN (SELECT id FROM expired) RETURNING id
  `;
}

/** 古い配達を最大 limit 行消す。送っている途中の行(queued・sending)は消さない */
export function expiredDeliveriesDeleteSql(cutoff: Date, limit: number): SQL {
  return sql`
    WITH expired AS (
      SELECT id FROM message_deliveries
      WHERE created_at < ${cutoff.toISOString()}::timestamptz AND status NOT IN ('queued', 'sending')
      ORDER BY created_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    DELETE FROM message_deliveries WHERE id IN (SELECT id FROM expired) RETURNING id
  `;
}

/** 消してよい古い回を最大 limit 行、排他で取る(processing・scheduled と、お知らせが参照する回は残す) */
export function expiredDispatchesSelectSql(cutoff: Date, limit: number): SQL {
  return sql`
    SELECT d.id, d.metadata FROM message_dispatches d
    WHERE d.created_at < ${cutoff.toISOString()}::timestamptz
      AND d.status NOT IN ('processing', 'scheduled')
      AND NOT EXISTS (SELECT 1 FROM message_inbox_items i WHERE i.dispatch_id = d.id)
    ORDER BY d.created_at
    LIMIT ${limit}
    FOR UPDATE OF d SKIP LOCKED
  `;
}
