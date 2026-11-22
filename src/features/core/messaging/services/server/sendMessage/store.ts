// src/features/core/messaging/services/server/sendMessage/store.ts
//
// 送る口の DB の読み書き(drizzle)。送る口の処理は MessageSendStore の形だけを見る(テストは偽物を渡す)。

import { and, asc, count, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { UserTable } from "@/features/core/user/entities/drizzle";
import { availableUserWhere } from "@/features/core/user/services/server/availableUsers";

import { MessageDeliveryTable, MessageEventTable } from "../../../entities/delivery";
import { MessageDispatchTable } from "../../../entities/drizzle";
import { MessageEndpointTable } from "../../../entities/endpoint";
import { MessageIdempotencyKeyTable } from "../../../entities/idempotencyKey";
import { MessagePreferenceTable, MessageSuppressionTable } from "../../../entities/preference";
import { MessageDispatchRecipientTable } from "../../../entities/recipient";
import { MESSAGE_ALL } from "../../../entities/schema";
import { MessageIdempotencyConflict } from "./errors";
import type { MessageSendStore } from "./types";

/**
 * PostgreSQL の UNIQUE 制約違反 (SQLSTATE 23505) か。code はエラー本体か cause に乗る
 */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth++) {
    if (typeof current === "object" && "code" in current && (current as { code?: unknown }).code === "23505") {
      return true;
    }
    current = typeof current === "object" && "cause" in current ? (current as { cause?: unknown }).cause : null;
  }
  return false;
}

/**
 * 渡した冪等の鍵のうち、既に使われたもの(message_dispatches か message_idempotency_keys にある)を返す。
 * 一括の送り手(財布の失効の知らせなど)がページごとに送信済みを除くためのもの。2 回の問い合わせ(表ごとに 1 回)。
 * 存在だけを見る(鍵の行は送る前に入るので、送れなかった送信も「ある」側に入る)
 */
export async function existingIdempotencyKeys(keys: readonly string[]): Promise<Set<string>> {
  const unique = [...new Set(keys)];
  if (unique.length === 0) return new Set();
  const [dispatches, moved] = await Promise.all([
    db
      .select({ key: MessageDispatchTable.idempotency_key })
      .from(MessageDispatchTable)
      .where(inArray(MessageDispatchTable.idempotency_key, unique)),
    db
      .select({ key: MessageIdempotencyKeyTable.idempotency_key })
      .from(MessageIdempotencyKeyTable)
      .where(inArray(MessageIdempotencyKeyTable.idempotency_key, unique)),
  ]);
  return new Set([...dispatches, ...moved].flatMap((row) => (row.key ? [row.key] : [])));
}

export const drizzleMessageSendStore: MessageSendStore = {
  async idempotencyKeyExists(key) {
    const [dispatch] = await db
      .select({ id: MessageDispatchTable.id })
      .from(MessageDispatchTable)
      .where(eq(MessageDispatchTable.idempotency_key, key))
      .limit(1);
    if (dispatch) return true;
    const [moved] = await db
      .select({ key: MessageIdempotencyKeyTable.idempotency_key })
      .from(MessageIdempotencyKeyTable)
      .where(eq(MessageIdempotencyKeyTable.idempotency_key, key))
      .limit(1);
    return Boolean(moved);
  },

  async insertDispatch(values) {
    try {
      const [created] = await db
        .insert(MessageDispatchTable)
        .values(values)
        .returning({ id: MessageDispatchTable.id });
      return created;
    } catch (error) {
      if (isUniqueViolation(error)) throw new MessageIdempotencyConflict();
      throw error;
    }
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

  async insertDeliveries(rows, eventsFor) {
    if (rows.length === 0) return [];
    const insert = (client: Pick<typeof db, "insert">) =>
      client
        .insert(MessageDeliveryTable)
        .values([...rows])
        .onConflictDoNothing({
          target: [MessageDeliveryTable.dispatch_id, MessageDeliveryTable.channel, MessageDeliveryTable.recipient_key],
        })
        .returning();
    if (!eventsFor) return insert(db);
    return db.transaction(async (tx) => {
      const created = await insert(tx);
      const events = eventsFor(created);
      if (events.length > 0) await tx.insert(MessageEventTable).values(events);
      return created;
    });
  },

  async updateDelivery(id, patch, events) {
    if (!events?.length) {
      await db.update(MessageDeliveryTable).set(patch).where(eq(MessageDeliveryTable.id, id));
      return;
    }
    await db.transaction(async (tx) => {
      await tx.update(MessageDeliveryTable).set(patch).where(eq(MessageDeliveryTable.id, id));
      await tx.insert(MessageEventTable).values([...events]);
    });
  },

  async findUsers(ids) {
    if (ids.length === 0) return [];
    return db
      .select({ id: UserTable.id, name: UserTable.name, email: UserTable.email })
      .from(UserTable)
      .where(and(inArray(UserTable.id, [...ids]), isNull(UserTable.deletedAt)));
  },

  async listUserIds(filter, cursor, limit) {
    // 全員・ロール宛ては利用できる利用者だけ(user の公開の述語: 削除されていない・利用できる状態・デモでない)
    const conditions = [availableUserWhere()];
    if (filter.roles) {
      conditions.push(inArray(UserTable.role, [...filter.roles] as (typeof UserTable.role.enumValues)[number][]));
    }
    // 送り始めの線より後に登録した利用者は入れない
    if (filter.createdBefore) conditions.push(lte(UserTable.createdAt, filter.createdBefore));
    if (cursor) conditions.push(gt(UserTable.id, cursor));
    const rows = await db
      .select({ id: UserTable.id })
      .from(UserTable)
      .where(and(...conditions))
      .orderBy(asc(UserTable.id))
      .limit(limit);
    const userIds = rows.map((row) => row.id);
    return { userIds, nextCursor: userIds.length === limit ? userIds[userIds.length - 1] : null };
  },

  async countUserIds(filter) {
    const conditions = [availableUserWhere()];
    if (filter.roles) {
      conditions.push(inArray(UserTable.role, [...filter.roles] as (typeof UserTable.role.enumValues)[number][]));
    }
    const [row] = await db.select({ value: count() }).from(UserTable).where(and(...conditions));
    return Number(row?.value ?? 0);
  },

  async listRecipientIds(dispatchId, cursor, limit) {
    const R = MessageDispatchRecipientTable;
    const rows = await db
      .select({ id: R.user_id })
      .from(R)
      .innerJoin(UserTable, eq(UserTable.id, R.user_id))
      .where(and(eq(R.dispatch_id, dispatchId), isNull(UserTable.deletedAt), cursor ? gt(R.user_id, cursor) : undefined))
      .orderBy(asc(R.user_id))
      .limit(limit);
    const userIds = rows.map((row) => row.id);
    return { userIds, nextCursor: userIds.length === limit ? userIds[userIds.length - 1]! : null };
  },

  async findOptOuts(userIds, category, kind, channels, groupRow) {
    if (userIds.length === 0) return [];
    // 当たる category = そのカテゴリー・全部 '*'・入っているグループの行(D123)
    const categories = groupRow ? [category, MESSAGE_ALL, groupRow] : [category, MESSAGE_ALL];
    const rows = await db
      .select({ userId: MessagePreferenceTable.user_id, channel: MessagePreferenceTable.channel })
      .from(MessagePreferenceTable)
      .where(
        and(
          inArray(MessagePreferenceTable.user_id, [...userIds]),
          inArray(MessagePreferenceTable.category, categories),
          inArray(MessagePreferenceTable.channel, [...channels, MESSAGE_ALL]),
          // kind の行(種別まるごと)は連絡の種別が同じ時だけ当たる。kind '*' の行は今までどおり
          kind
            ? inArray(MessagePreferenceTable.kind, [MESSAGE_ALL, kind])
            : eq(MessagePreferenceTable.kind, MESSAGE_ALL),
        ),
      );
    return rows;
  },

  async findSuppressions(channel, addressHashes) {
    if (addressHashes.length === 0) return [];
    return db
      .select({
        addressHash: MessageSuppressionTable.address_hash,
        reason: MessageSuppressionTable.reason,
        scope: MessageSuppressionTable.scope,
      })
      .from(MessageSuppressionTable)
      .where(
        and(
          eq(MessageSuppressionTable.channel, channel),
          inArray(MessageSuppressionTable.address_hash, [...addressHashes]),
        ),
      );
  },

  async touchEndpoints(channel, entries, at) {
    if (entries.length === 0) return;
    // (channel, address) は UNIQUE。user_id も条件に入れて、他人の行には触らない
    await db
      .update(MessageEndpointTable)
      .set({ last_used_at: at })
      .where(
        and(
          eq(MessageEndpointTable.channel, channel),
          inArray(MessageEndpointTable.address, [...new Set(entries.map((entry) => entry.address))]),
          inArray(MessageEndpointTable.user_id, [...new Set(entries.map((entry) => entry.userId))]),
        ),
      );
  },

  async findActiveEndpoints(channel, userIds) {
    if (userIds.length === 0) return [];
    const rows = await db
      .select({ userId: MessageEndpointTable.user_id, address: MessageEndpointTable.address })
      .from(MessageEndpointTable)
      .where(
        and(
          eq(MessageEndpointTable.channel, channel),
          eq(MessageEndpointTable.is_active, true),
          inArray(MessageEndpointTable.user_id, [...userIds]),
        ),
      );
    return rows;
  },
};
