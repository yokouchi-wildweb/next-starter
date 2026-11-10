// src/features/core/messaging/services/server/sendMessage/store.ts
//
// 送る口の DB の読み書き(drizzle)。送る口の処理は MessageSendStore の形だけを見る(テストは偽物を渡す)。

import { and, asc, eq, gt, inArray, isNull } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { USER_AVAILABLE_STATUSES } from "@/features/core/user/constants";
import { UserTable } from "@/features/core/user/entities/drizzle";

import { MessageDeliveryTable } from "../../../entities/delivery";
import { MessageDispatchTable } from "../../../entities/drizzle";
import { MessageEndpointTable } from "../../../entities/endpoint";
import { MessageIdempotencyKeyTable } from "../../../entities/idempotencyKey";
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

  async updateDispatch(id, patch) {
    await db.update(MessageDispatchTable).set(patch).where(eq(MessageDispatchTable.id, id));
  },

  async insertDeliveries(rows) {
    if (rows.length === 0) return [];
    return db
      .insert(MessageDeliveryTable)
      .values([...rows])
      .onConflictDoNothing({
        target: [MessageDeliveryTable.dispatch_id, MessageDeliveryTable.channel, MessageDeliveryTable.recipient_key],
      })
      .returning();
  },

  async updateDelivery(id, patch) {
    await db.update(MessageDeliveryTable).set(patch).where(eq(MessageDeliveryTable.id, id));
  },

  async findUsers(ids) {
    if (ids.length === 0) return [];
    return db
      .select({ id: UserTable.id, name: UserTable.name, email: UserTable.email })
      .from(UserTable)
      .where(and(inArray(UserTable.id, [...ids]), isNull(UserTable.deletedAt)));
  },

  async listUserIds(filter, cursor, limit) {
    // 全員・ロール宛ては利用できる利用者(USER_AVAILABLE_STATUSES)だけ
    const conditions = [isNull(UserTable.deletedAt), inArray(UserTable.status, [...USER_AVAILABLE_STATUSES])];
    if (filter.roles) {
      conditions.push(inArray(UserTable.role, [...filter.roles] as (typeof UserTable.role.enumValues)[number][]));
    }
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
