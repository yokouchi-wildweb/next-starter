// src/features/core/messaging/services/server/admin/store.ts
//
// 回の読む口の DB(drizzle)。keyset: 回は (created_at, id) の降順、配達は昇順。
// 回の宛先の利用者 = 配達の user_id の重なりを除いた並び(「同じ内容で送る」の写し。経路ごとの行を 1 人にまとめる)

import { and, arrayContains, asc, desc, eq, gt, gte, isNotNull, lt, or, type SQL } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { MessageDeliveryTable } from "../../../entities/delivery";
import { MessageDispatchTable } from "../../../entities/drizzle";
import type { MessageDeliveryStatus } from "../../../entities/model";
import type { AdminDispatchStore } from "./readDispatches";

export const drizzleAdminDispatchStore: AdminDispatchStore = {
  async listDispatches(filter, after, limit) {
    const t = MessageDispatchTable;
    const conditions: SQL[] = [];
    if (filter.from) conditions.push(gte(t.createdAt, filter.from));
    if (filter.to) conditions.push(lt(t.createdAt, filter.to));
    if (filter.category) conditions.push(eq(t.category, filter.category));
    if (filter.kind) conditions.push(eq(t.kind, filter.kind));
    if (filter.channel) conditions.push(arrayContains(t.channels, [filter.channel]));
    if (filter.status) conditions.push(eq(t.status, filter.status));
    if (after) {
      conditions.push(or(lt(t.createdAt, after.createdAt), and(eq(t.createdAt, after.createdAt), lt(t.id, after.id)))!);
    }
    return db
      .select()
      .from(t)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(t.createdAt), desc(t.id))
      .limit(limit);
  },

  async findDispatch(id) {
    const [row] = await db.select().from(MessageDispatchTable).where(eq(MessageDispatchTable.id, id)).limit(1);
    return row ?? null;
  },

  async listDeliveries(dispatchId, filter, after, limit) {
    const t = MessageDeliveryTable;
    const conditions: SQL[] = [eq(t.dispatch_id, dispatchId)];
    if (filter.status) conditions.push(eq(t.status, filter.status as MessageDeliveryStatus));
    if (filter.channel) conditions.push(eq(t.channel, filter.channel));
    if (after) {
      conditions.push(or(gt(t.createdAt, after.createdAt), and(eq(t.createdAt, after.createdAt), gt(t.id, after.id)))!);
    }
    return db
      .select()
      .from(t)
      .where(and(...conditions))
      .orderBy(asc(t.createdAt), asc(t.id))
      .limit(limit);
  },

  async listDispatchUserIds(dispatchId, limit) {
    const t = MessageDeliveryTable;
    const rows = await db
      .selectDistinct({ userId: t.user_id })
      .from(t)
      .where(and(eq(t.dispatch_id, dispatchId), isNotNull(t.user_id)))
      .orderBy(asc(t.user_id))
      .limit(limit);
    return rows.flatMap((row) => (row.userId ? [row.userId] : []));
  },
};
