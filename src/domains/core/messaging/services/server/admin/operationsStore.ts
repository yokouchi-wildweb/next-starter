// src/domains/core/messaging/services/server/admin/operationsStore.ts
//
// 管理の操作の DB(drizzle)。どの操作も送信の行を FOR UPDATE で持った 1 つの取引で行う(cron の展開・予約の拾いと重ならない)。
// 配達は FOR UPDATE SKIP LOCKED で取り、lease 中(sending)の行は触らない(cron と再送が同じ宛先を二重に送らない)

import { and, eq, inArray, isNotNull, isNull, lt, notInArray, or, sql } from "drizzle-orm";

import { db, type TransactionClient } from "@/lib/drizzle";

import { MessageDeliveryTable } from "../../../entities/delivery";
import { MessageDispatchTable } from "../../../entities/drizzle";
import { MessageInboxItemTable } from "../../../entities/inbox";
import type { MessageDeliveryTarget } from "../../../entities/schema";
import { isDispatchId } from "../dispatchId";
import type { FailedDeliveryRow, MessageOperationsStore } from "./operationsTypes";

const d = MessageDeliveryTable;

/** lease を持っていない行(lease が切れた行も含む) */
function notLeased(now: Date) {
  return or(isNull(d.locked_until), lt(d.locked_until, now));
}

function statusesOf(includeUnknown: boolean): ("failed" | "unknown")[] {
  return includeUnknown ? ["failed", "unknown"] : ["failed"];
}

export const drizzleMessageOperationsStore: MessageOperationsStore<TransactionClient> = {
  withLockedDispatch: (id, run) =>
    db.transaction(async (tx) => {
      // uuid の形でない id は無い送信(読まずに null。呼び手が 404)
      if (!isDispatchId(id)) return run(tx, null);
      const [row] = await tx.select().from(MessageDispatchTable).where(eq(MessageDispatchTable.id, id)).limit(1).for("update");
      return run(tx, row ?? null);
    }),

  async updateDispatch(tx, id, patch) {
    await tx.update(MessageDispatchTable).set(patch).where(eq(MessageDispatchTable.id, id));
  },

  async cancelUnsent(tx, dispatchId, now) {
    const queued = await tx
      .update(d)
      .set({ status: "canceled", next_attempt_at: null, updatedAt: now })
      .where(and(eq(d.dispatch_id, dispatchId), eq(d.status, "queued")))
      .returning({ id: d.id });
    // 送れた行の宛先ごとの送り直しの予定(next_attempt_at あり)を止める
    const retrying = await tx
      .select({ id: d.id, targets: d.targets })
      .from(d)
      .where(and(eq(d.dispatch_id, dispatchId), eq(d.status, "sent"), isNotNull(d.next_attempt_at), notLeased(now)))
      .for("update", { skipLocked: true });
    for (const row of retrying) {
      const targets = (row.targets as MessageDeliveryTarget[] | null)?.map((target) =>
        target.status === "queued" ? { ...target, status: "canceled" as const, next_attempt_at: null } : target,
      );
      await tx.update(d).set({ next_attempt_at: null, targets: targets ?? null, updatedAt: now }).where(eq(d.id, row.id));
    }
    return queued.length + retrying.length;
  },

  async findDispatches(ids) {
    const valid = ids.filter(isDispatchId);
    if (valid.length === 0) return [];
    return db
      .select({ id: MessageDispatchTable.id, status: MessageDispatchTable.status, deleted_at: MessageDispatchTable.deleted_at })
      .from(MessageDispatchTable)
      .where(inArray(MessageDispatchTable.id, valid));
  },

  async deliveryCounts(dispatchIds) {
    if (dispatchIds.length === 0) return [];
    const rows = await db
      .select({ channel: d.channel, status: d.status, count: sql<number>`count(*)::int` })
      .from(d)
      .where(inArray(d.dispatch_id, [...dispatchIds]))
      .groupBy(d.channel, d.status);
    return rows.map((row) => ({ channel: row.channel, status: row.status, count: Number(row.count) }));
  },

  async countSharedInbox(dispatchIds) {
    if (dispatchIds.length === 0) return 0;
    const [row] = await db
      .select({ count: sql<number>`count(distinct ${MessageInboxItemTable.dispatch_id})::int` })
      .from(MessageInboxItemTable)
      .where(and(inArray(MessageInboxItemTable.dispatch_id, [...dispatchIds]), isNull(MessageInboxItemTable.user_id)));
    return Number(row?.count ?? 0);
  },

  async countFailed(tx, dispatchId) {
    const rows = await (tx ?? db)
      .select({ status: d.status, count: sql<number>`count(*)::int` })
      .from(d)
      .where(and(eq(d.dispatch_id, dispatchId), inArray(d.status, ["failed", "unknown"])))
      .groupBy(d.status);
    const of = (status: string) => Number(rows.find((row) => row.status === status)?.count ?? 0);
    return { failed: of("failed"), unknown: of("unknown") };
  },

  async requeueFailed(tx, dispatchId, { includeUnknown, now }) {
    const rows = await tx
      .select({ id: d.id, status: d.status, targets: d.targets })
      .from(d)
      .where(and(eq(d.dispatch_id, dispatchId), inArray(d.status, statusesOf(includeUnknown)), notLeased(now)))
      .for("update", { skipLocked: true });
    for (const row of rows) {
      const targets = (row.targets as MessageDeliveryTarget[] | null)?.map((target) =>
        target.status === "failed" || target.status === "unknown"
          ? { ...target, status: "queued" as const, attempts: 0, next_attempt_at: null, last_error: null }
          : target,
      );
      await tx
        .update(d)
        .set({
          status: "queued",
          next_attempt_at: now,
          attempts: 0,
          last_error: null,
          failed_at: null,
          locked_until: null,
          lock_token: null,
          targets: targets ?? null,
          updatedAt: now,
        })
        .where(eq(d.id, row.id));
    }
    return {
      failed: rows.filter((row) => row.status === "failed").length,
      unknown: rows.filter((row) => row.status === "unknown").length,
    };
  },

  async listFailed(tx, dispatchId, { includeUnknown, excludeIds }) {
    const rows = await tx
      .select({ id: d.id, recipientKey: d.recipient_key, userId: d.user_id, address: d.address, channel: d.channel, status: d.status })
      .from(d)
      .where(
        and(
          eq(d.dispatch_id, dispatchId),
          inArray(d.status, statusesOf(includeUnknown)),
          notLeased(new Date()),
          excludeIds.length > 0 ? notInArray(d.id, [...excludeIds]) : undefined,
        ),
      );
    return rows as FailedDeliveryRow[];
  },
};
