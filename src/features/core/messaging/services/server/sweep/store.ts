// src/features/core/messaging/services/server/sweep/store.ts
//
// 掃き出し・保持の掃除の DB の読み書き(drizzle)。
// - 配達の行の取り: UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) で lease を付ける(並走する cron と重ならない)
// - 展開: 回の行を FOR UPDATE SKIP LOCKED で取り、配達の行と再開の位置を同じ取引で書く
// - 消す: SKIP LOCKED の CTE で 1 文 = 最大 limit 行(auditLog の掃除と同じ形)

import { and, asc, count, eq, inArray, isNotNull, isNull, lt, lte, ne, notExists, or, sql } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { MessageDeliveryTable } from "../../../entities/delivery";
import { MessageDispatchTable } from "../../../entities/drizzle";
import { MessageIdempotencyKeyTable } from "../../../entities/idempotencyKey";
import { MessageInboxItemTable } from "../../../entities/inbox";
import { MESSAGE_EXPAND_DONE } from "../../../entities/schema";
import { boundInboxImageRefs } from "../inbox/imageBinding";
import { cleanupDetachedInboxImages, detachInboxImages, storageInboxImageLedger } from "../inbox/imageBindingLedger";
import { bindExpansionImage } from "./expandImage";
import type { MessageRetentionStore, MessageSweepStore } from "./types";

const IN_FLIGHT = ["queued", "sending"] as const;

/** db.execute の行(ドライバにより配列か { rows }) */
function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown }).rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

export const drizzleMessageSweepStore: MessageSweepStore = {
  async activateScheduled(now, limit) {
    const due = db
      .select({ id: MessageDispatchTable.id })
      .from(MessageDispatchTable)
      .where(and(eq(MessageDispatchTable.status, "scheduled"), lte(MessageDispatchTable.scheduled_at, now)))
      .limit(limit)
      .for("update", { skipLocked: true });
    const rows = await db
      .update(MessageDispatchTable)
      .set({ status: "processing", updatedAt: now })
      .where(inArray(MessageDispatchTable.id, due))
      .returning({ id: MessageDispatchTable.id });
    return rows.length;
  },

  async expandOne(dispatchId, step) {
    return db.transaction(async (tx) => {
      const conditions = [
        eq(MessageDispatchTable.status, "processing"),
        // 古い送る口の行(message_key なし)は展開しない
        isNotNull(MessageDispatchTable.message_key),
        or(isNull(MessageDispatchTable.expand_cursor), ne(MessageDispatchTable.expand_cursor, MESSAGE_EXPAND_DONE)),
      ];
      if (dispatchId) conditions.push(eq(MessageDispatchTable.id, dispatchId));
      const [dispatch] = await tx
        .select()
        .from(MessageDispatchTable)
        .where(and(...conditions))
        .orderBy(asc(MessageDispatchTable.createdAt))
        .limit(1)
        .for("update", { skipLocked: true });
      if (!dispatch) return false;
      // 共有のお知らせの行の画像は回に結ぶ(回の行を排他で持ったこの取引の中で)
      const write = await bindExpansionImage(storageInboxImageLedger, tx, dispatch, await step(dispatch));
      if (write.rows.length > 0) {
        await tx
          .insert(MessageDeliveryTable)
          .values(write.rows)
          .onConflictDoNothing({
            target: [MessageDeliveryTable.dispatch_id, MessageDeliveryTable.channel, MessageDeliveryTable.recipient_key],
          });
      }
      if (write.inboxItem) await tx.insert(MessageInboxItemTable).values(write.inboxItem);
      await tx.update(MessageDispatchTable).set(write.patch).where(eq(MessageDispatchTable.id, dispatch.id));
      return true;
    });
  },

  async claimDue({ now, limit, leaseUntil, lockToken, dispatchId }) {
    const conditions = [
      lte(MessageDeliveryTable.next_attempt_at, now),
      inArray(MessageDeliveryTable.status, ["queued", "sent"]),
      or(isNull(MessageDeliveryTable.locked_until), lt(MessageDeliveryTable.locked_until, now)),
    ];
    if (dispatchId) conditions.push(eq(MessageDeliveryTable.dispatch_id, dispatchId));
    const due = db
      .select({ id: MessageDeliveryTable.id })
      .from(MessageDeliveryTable)
      .where(and(...conditions))
      .orderBy(asc(MessageDeliveryTable.next_attempt_at))
      .limit(limit)
      .for("update", { skipLocked: true });
    return db
      .update(MessageDeliveryTable)
      .set({ status: "sending", locked_until: leaseUntil, lock_token: lockToken, updatedAt: now })
      .where(inArray(MessageDeliveryTable.id, due))
      .returning();
  },

  async updateClaimed(id, lockToken, patch) {
    await db
      .update(MessageDeliveryTable)
      .set(patch)
      .where(and(eq(MessageDeliveryTable.id, id), eq(MessageDeliveryTable.lock_token, lockToken)));
  },

  async markStaleSending(now, limit) {
    const stale = db
      .select({ id: MessageDeliveryTable.id })
      .from(MessageDeliveryTable)
      .where(and(eq(MessageDeliveryTable.status, "sending"), lt(MessageDeliveryTable.locked_until, now)))
      .limit(limit)
      .for("update", { skipLocked: true });
    const rows = await db
      .update(MessageDeliveryTable)
      .set({
        status: "unknown",
        last_error: "stale_sending",
        next_attempt_at: null,
        locked_until: null,
        lock_token: null,
        updatedAt: now,
      })
      .where(inArray(MessageDeliveryTable.id, stale))
      .returning({ id: MessageDeliveryTable.id });
    return rows.length;
  },

  async findDispatches(ids) {
    if (ids.length === 0) return [];
    return db.select().from(MessageDispatchTable).where(inArray(MessageDispatchTable.id, [...ids]));
  },

  async findCompletable(limit, dispatchId) {
    const pending = db
      .select({ id: MessageDeliveryTable.id })
      .from(MessageDeliveryTable)
      .where(
        and(
          eq(MessageDeliveryTable.dispatch_id, MessageDispatchTable.id),
          or(inArray(MessageDeliveryTable.status, [...IN_FLIGHT]), isNotNull(MessageDeliveryTable.next_attempt_at)),
        ),
      );
    const conditions = [
      eq(MessageDispatchTable.status, "processing"),
      eq(MessageDispatchTable.expand_cursor, MESSAGE_EXPAND_DONE),
      notExists(pending),
    ];
    if (dispatchId) conditions.push(eq(MessageDispatchTable.id, dispatchId));
    return db
      .select()
      .from(MessageDispatchTable)
      .where(and(...conditions))
      .orderBy(asc(MessageDispatchTable.createdAt))
      .limit(limit);
  },

  async aggregateDeliveries(dispatchId) {
    const rows = await db
      .select({ channel: MessageDeliveryTable.channel, status: MessageDeliveryTable.status, count: count() })
      .from(MessageDeliveryTable)
      .where(eq(MessageDeliveryTable.dispatch_id, dispatchId))
      .groupBy(MessageDeliveryTable.channel, MessageDeliveryTable.status);
    return rows.map((row) => ({ channel: row.channel, status: row.status, count: Number(row.count) }));
  },

  async updateDispatch(id, patch) {
    await db.update(MessageDispatchTable).set(patch).where(eq(MessageDispatchTable.id, id));
  },
};

export const drizzleMessageRetentionStore: MessageRetentionStore = {
  async deleteEventsBefore(cutoff, limit) {
    const result = await db.execute(sql`
      WITH expired AS (
        SELECT id FROM message_events
        WHERE created_at < ${cutoff}
        ORDER BY created_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM message_events WHERE id IN (SELECT id FROM expired) RETURNING id
    `);
    return rowsOf(result).length;
  },

  async deleteDeliveriesBefore(cutoff, limit) {
    // 送っている途中の行(queued・sending)は消さない
    const result = await db.execute(sql`
      WITH expired AS (
        SELECT id FROM message_deliveries
        WHERE created_at < ${cutoff} AND status NOT IN ('queued', 'sending')
        ORDER BY created_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM message_deliveries WHERE id IN (SELECT id FROM expired) RETURNING id
    `);
    return rowsOf(result).length;
  },

  async deleteDispatchesBefore(cutoff, limit) {
    // 1 つの取引: 消す回を排他で取る → 回に結んだお知らせの画像を台帳から外す(record_removed)→ 冪等の鍵を移す → 消す。
    // 外した画像の実物は commit の後に消す(失敗は storage の掃除が拾う)
    const detachedIds: string[] = [];
    const out = await db.transaction(async (tx) => {
      const expired = rowsOf<{ id: string; metadata: Record<string, unknown> | null }>(
        await tx.execute(sql`
          SELECT d.id, d.metadata FROM message_dispatches d
          WHERE d.created_at < ${cutoff}
            AND d.status NOT IN ('processing', 'scheduled')
            AND NOT EXISTS (SELECT 1 FROM message_inbox_items i WHERE i.dispatch_id = d.id)
          ORDER BY d.created_at
          LIMIT ${limit}
          FOR UPDATE OF d SKIP LOCKED
        `),
      );
      if (expired.length === 0) return { deleted: 0, movedKeys: 0, detachedImages: 0 };
      for (const row of expired) {
        detachedIds.push(...(await detachInboxImages(tx, row.id, boundInboxImageRefs(row.metadata))));
      }
      const ids = sql.join(
        expired.map((row) => sql`${row.id}::uuid`),
        sql`, `,
      );
      const result = await tx.execute(sql`
        WITH moved AS (
          INSERT INTO message_idempotency_keys (idempotency_key, dispatch_id)
          SELECT idempotency_key, id FROM message_dispatches WHERE id IN (${ids}) AND idempotency_key IS NOT NULL
          ON CONFLICT (idempotency_key) DO NOTHING
          RETURNING idempotency_key
        ),
        deleted AS (
          DELETE FROM message_dispatches WHERE id IN (${ids}) RETURNING id
        )
        SELECT (SELECT count(*) FROM deleted)::int AS deleted, (SELECT count(*) FROM moved)::int AS moved
      `);
      const [row] = rowsOf<{ deleted: number | string; moved: number | string }>(result);
      return { deleted: Number(row?.deleted ?? 0), movedKeys: Number(row?.moved ?? 0), detachedImages: detachedIds.length };
    });
    await cleanupDetachedInboxImages(detachedIds);
    return out;
  },

  async deleteIdempotencyKeysBefore(cutoff, limit) {
    const rows = await db
      .delete(MessageIdempotencyKeyTable)
      .where(
        inArray(
          MessageIdempotencyKeyTable.idempotency_key,
          db
            .select({ key: MessageIdempotencyKeyTable.idempotency_key })
            .from(MessageIdempotencyKeyTable)
            .where(lt(MessageIdempotencyKeyTable.createdAt, cutoff))
            .limit(limit)
            .for("update", { skipLocked: true }),
        ),
      )
      .returning({ key: MessageIdempotencyKeyTable.idempotency_key });
    return rows.length;
  },
};
