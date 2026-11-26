// src/domains/core/messaging/services/server/sweep/store.ts
//
// 掃き出し・保持の掃除の DB の読み書き(drizzle)。
// - 配達の行の取り: UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) で lease を付ける(並走する cron と重ならない)
// - 展開: 送信の行を FOR UPDATE SKIP LOCKED で取り、配達の行と再開の位置を同じ取引で書く
// - グループ宛ての固定(D58): 同じ取引の savepoint で SET LOCAL statement_timeout の後に 1 文の INSERT … SELECT(時間の上限なら savepoint を戻し送信を止める)
// - 消す: SKIP LOCKED の CTE で 1 文 = 最大 limit 行(auditLog の掃除と同じ形)。配達の重い列は同じ形の UPDATE で null にする

import { and, asc, count, eq, inArray, isNotNull, isNull, lt, lte, ne, notExists, or, sql } from "drizzle-orm";

import { db, type TransactionClient } from "@/lib/drizzle";
import { UserTable } from "@/domains/core/user/entities/drizzle";
import { availableUserWhere } from "@/domains/core/user/services/server/availableUsers";

import { MessageDeliveryTable, MessageEventTable } from "../../../entities/drizzle";
import { MessageDispatchTable } from "../../../entities/drizzle";
import { MessageIdempotencyKeyTable } from "../../../entities/drizzle";
import { MessageInboxItemTable } from "../../../entities/drizzle";
import type { MessageDispatchInsert } from "../../../entities/model";
import { MessageDispatchRecipientTable } from "../../../entities/drizzle";
import { MESSAGE_EXPAND_DONE } from "../../../constants/domain";
import { isDispatchId } from "../dispatchId";
import { boundInboxImageRefs } from "../inbox/imageBinding";
import { cleanupDetachedInboxImages, detachInboxImages, storageInboxImageLedger } from "../inbox/imageBindingLedger";
import { bindExpansionImage } from "./expandImage";
import {
  expiredDeliveriesDeleteSql,
  expiredDeliveryContentClearSql,
  expiredDispatchesSelectSql,
  expiredEventsDeleteSql,
} from "./retentionSql";
import type { ExpansionWrite, MessageRetentionStore, MessageSweepStore } from "./types";

const IN_FLIGHT = ["queued", "sending"] as const;

/** db.execute の行(ドライバにより配列か { rows }) */
function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown }).rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

const TIMEOUT_CODE = "57014";

function isStatementTimeout(error: unknown): boolean {
  for (let current: unknown = error, depth = 0; current && depth < 5; depth += 1) {
    if ((current as { code?: unknown }).code === TIMEOUT_CODE) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * グループの一員を送信の受信者の一覧へ 1 文で書く(1 つの時点。利用できる利用者・送り始めの線以前の登録だけ)。
 * 時間の上限を超えたら false(savepoint を戻すので取引は続けられる)
 */
async function freezeRecipients(tx: TransactionClient, dispatchId: string, freeze: NonNullable<ExpansionWrite["freeze"]>): Promise<boolean> {
  try {
    await tx.transaction(async (savepoint) => {
      await savepoint.execute(sql.raw(`set local statement_timeout = ${Math.max(1, Math.floor(freeze.timeoutMs))}`));
      await savepoint
        .insert(MessageDispatchRecipientTable)
        .select(
          savepoint
            .select({ dispatch_id: sql<string>`${dispatchId}::uuid`.as("dispatch_id"), user_id: UserTable.id })
            .from(UserTable)
            .where(and(freeze.where, availableUserWhere(), lte(UserTable.createdAt, freeze.createdBefore))),
        )
        .onConflictDoNothing();
    });
    return true;
  } catch (error) {
    if (isStatementTimeout(error)) return false;
    throw error;
  }
}

export const drizzleMessageSweepStore: MessageSweepStore = {
  async activateScheduled(now, limit) {
    const due = db
      .select({ id: MessageDispatchTable.id })
      .from(MessageDispatchTable)
      // 削除した予約の送信は拾わない(D88)
      .where(
        and(
          eq(MessageDispatchTable.status, "scheduled"),
          lte(MessageDispatchTable.scheduled_at, now),
          isNull(MessageDispatchTable.deleted_at),
        ),
      )
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
        // 古い送る口の行(レイアウトなし)は展開しない。テンプレートからの送信は message_key が null なので鍵では見ない(D128)
        isNotNull(MessageDispatchTable.layout),
        // 削除した送信は展開しない(削除は展開の位置も終わりにする。念のため)
        isNull(MessageDispatchTable.deleted_at),
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
      // 共有のお知らせの行の画像は送信に結ぶ(送信の行を排他で持ったこの取引の中で)
      const write = await bindExpansionImage(storageInboxImageLedger, tx, dispatch, await step(dispatch));
      if (write.freeze) {
        const frozen = await freezeRecipients(tx, dispatch.id, write.freeze);
        const patch: Partial<MessageDispatchInsert> = frozen ? write.patch : write.freeze.timeoutPatch;
        await tx.update(MessageDispatchTable).set(patch).where(eq(MessageDispatchTable.id, dispatch.id));
        return true;
      }
      if (write.rows.length > 0) {
        const created = await tx
          .insert(MessageDeliveryTable)
          .values(write.rows)
          .onConflictDoNothing({
            target: [MessageDeliveryTable.dispatch_id, MessageDeliveryTable.channel, MessageDeliveryTable.recipient_key],
          })
          .returning();
        // 内部の事件(止めた行など)は配達の行と同じ取引で
        const events = write.eventsFor?.(created) ?? [];
        if (events.length > 0) await tx.insert(MessageEventTable).values(events);
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

  async updateClaimed(id, lockToken, patch, events) {
    const where = and(eq(MessageDeliveryTable.id, id), eq(MessageDeliveryTable.lock_token, lockToken));
    if (!events?.length) {
      await db.update(MessageDeliveryTable).set(patch).where(where);
      return;
    }
    await db.transaction(async (tx) => {
      const updated = await tx.update(MessageDeliveryTable).set(patch).where(where).returning({ id: MessageDeliveryTable.id });
      // lease を失った処理(lock_token が合わない)は行も事件も書かない
      if (updated.length > 0) await tx.insert(MessageEventTable).values([...events]);
    });
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
    // uuid の形でない id は無い送信(管理の「続きを送る」の [id]。Postgres の 500 にしない)
    const valid = ids.filter(isDispatchId);
    if (valid.length === 0) return [];
    return db.select().from(MessageDispatchTable).where(inArray(MessageDispatchTable.id, valid));
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
      .select({
        channel: MessageDeliveryTable.channel,
        status: MessageDeliveryTable.status,
        reason: MessageDeliveryTable.reason,
        count: count(),
      })
      .from(MessageDeliveryTable)
      .where(eq(MessageDeliveryTable.dispatch_id, dispatchId))
      .groupBy(MessageDeliveryTable.channel, MessageDeliveryTable.status, MessageDeliveryTable.reason);
    return rows.map((row) => ({ channel: row.channel, status: row.status, reason: row.reason ?? null, count: Number(row.count) }));
  },

  async updateDispatch(id, patch, events) {
    if (!events?.length) {
      await db.update(MessageDispatchTable).set(patch).where(eq(MessageDispatchTable.id, id));
      return;
    }
    await db.transaction(async (tx) => {
      await tx.update(MessageDispatchTable).set(patch).where(eq(MessageDispatchTable.id, id));
      await tx.insert(MessageEventTable).values([...events]);
    });
  },
};

export const drizzleMessageRetentionStore: MessageRetentionStore = {
  async deleteEventsBefore(cutoff, limit, maxSeq) {
    return rowsOf(await db.execute(expiredEventsDeleteSql(cutoff, limit, maxSeq))).length;
  },

  async clearDeliveryContentBefore(cutoff, limit) {
    return rowsOf(await db.execute(expiredDeliveryContentClearSql(cutoff, limit))).length;
  },

  async deleteDeliveriesBefore(cutoff, limit) {
    return rowsOf(await db.execute(expiredDeliveriesDeleteSql(cutoff, limit))).length;
  },

  async deleteDispatchesBefore(cutoff, limit) {
    // 1 つの取引: 消す送信を排他で取る → 送信に結んだお知らせの画像を台帳から外す(record_removed)→ 冪等の鍵を移す → 消す。
    // 外した画像の実物は commit の後に消す(失敗は storage の掃除が拾う)
    const detachedIds: string[] = [];
    const out = await db.transaction(async (tx) => {
      const expired = rowsOf<{ id: string; metadata: Record<string, unknown> | null }>(
        await tx.execute(expiredDispatchesSelectSql(cutoff, limit)),
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
