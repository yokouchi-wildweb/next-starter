// src/features/core/messaging/services/server/subscribers/store.ts
//
// 購読の cron の DB(drizzle)。印の前進は 1 文の GREATEST で単調(並走・古い値でも戻らない)

import { and, asc, eq, gt, inArray, isNotNull, lte, max, min, sql } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { MessageEventTable } from "../../../entities/delivery";
import type { MessageEventRow } from "../../../entities/model";
import { MessageSubscriberCursorTable, MessageSubscriberFailureTable } from "../../../entities/subscriber";
import type { SubscriberEvent, SubscriberStore } from "./types";

const e = MessageEventTable;
const c = MessageSubscriberCursorTable;
const f = MessageSubscriberFailureTable;

function toEvent(row: MessageEventRow): SubscriberEvent {
  return {
    id: row.id,
    seq: row.seq,
    type: row.type,
    messageKey: (row.message_key ?? null) as SubscriberEvent["messageKey"],
    dispatchId: row.dispatch_id ?? null,
    deliveryId: row.delivery_id ?? null,
    channel: row.channel ?? null,
    occurredAt: row.occurred_at,
    payload: row.payload ?? {},
  };
}

export const drizzleSubscriberStore: SubscriberStore = {
  async getMark(subscriberKey) {
    const [row] = await db.select({ seq: c.last_seq }).from(c).where(eq(c.subscriber_key, subscriberKey)).limit(1);
    return Number(row?.seq ?? 0);
  },

  async advanceMark(subscriberKey, seq) {
    await db
      .insert(c)
      .values({ subscriber_key: subscriberKey, last_seq: seq })
      .onConflictDoUpdate({
        target: c.subscriber_key,
        set: { last_seq: sql`GREATEST(${c.last_seq}, EXCLUDED.last_seq)`, updatedAt: sql`now()` },
      });
  },

  async upperSeq(cutoff) {
    const [row] = await db.select({ seq: max(e.seq) }).from(e).where(lte(e.createdAt, cutoff));
    return Number(row?.seq ?? 0);
  },

  async fetchEvents({ after, upTo, types, messages, channels, limit }) {
    if (types.length === 0) return [];
    const rows = await db
      .select()
      .from(e)
      .where(
        and(
          gt(e.seq, after),
          lte(e.seq, upTo),
          inArray(e.type, [...types]),
          messages && messages.length > 0 ? inArray(e.message_key, [...messages]) : undefined,
          channels && channels.length > 0 ? inArray(e.channel, [...channels]) : undefined,
        ),
      )
      .orderBy(asc(e.seq))
      .limit(limit);
    return rows.map(toEvent);
  },

  async findEvents(ids) {
    if (ids.length === 0) return [];
    return (await db.select().from(e).where(inArray(e.id, [...ids]))).map(toEvent);
  },

  async recordFailure({ subscriberKey, eventId, error, maxAttempts, now }) {
    const [row] = await db
      .insert(f)
      .values({
        subscriber_key: subscriberKey,
        event_id: eventId,
        attempts: 1,
        last_error: error,
        quarantined_at: maxAttempts <= 1 ? now : null,
      })
      .onConflictDoUpdate({
        target: [f.subscriber_key, f.event_id],
        set: {
          attempts: sql`${f.attempts} + 1`,
          last_error: error,
          // 一度隔離した行は隔離のまま(再処理の失敗も数える)
          quarantined_at: sql`COALESCE(${f.quarantined_at}, CASE WHEN ${f.attempts} + 1 >= ${maxAttempts} THEN ${now.toISOString()}::timestamptz ELSE NULL END)`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ attempts: f.attempts, quarantinedAt: f.quarantined_at });
    return { attempts: row.attempts, quarantined: row.quarantinedAt !== null };
  },

  async clearFailures(subscriberKey, eventIds) {
    if (eventIds.length === 0) return;
    await db.delete(f).where(and(eq(f.subscriber_key, subscriberKey), inArray(f.event_id, [...eventIds])));
  },

  async listQuarantined(subscriberKey, eventIds) {
    const rows = await db
      .select({ eventId: f.event_id })
      .from(f)
      .where(
        and(
          eq(f.subscriber_key, subscriberKey),
          isNotNull(f.quarantined_at),
          eventIds && eventIds.length > 0 ? inArray(f.event_id, [...eventIds]) : undefined,
        ),
      );
    return rows.map((row) => row.eventId);
  },

  async slowestMark(subscriberKeys) {
    if (subscriberKeys.length === 0) return null;
    const [row] = await db.select({ seq: min(c.last_seq), count: sql<number>`count(*)::int` }).from(c).where(inArray(c.subscriber_key, [...subscriberKeys]));
    // 印の行がまだ無い購読がある = その購読は 0 から読む
    if (Number(row?.count ?? 0) < subscriberKeys.length) return 0;
    return Number(row?.seq ?? 0);
  },
};
