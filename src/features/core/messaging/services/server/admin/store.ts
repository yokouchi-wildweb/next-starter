// src/features/core/messaging/services/server/admin/store.ts
//
// 回の読む口の DB(drizzle)。keyset: 回は (created_at, id) の降順、配達は昇順

import { and, arrayContains, asc, desc, eq, gt, gte, lt, or, type SQL } from "drizzle-orm";

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
    if (filter.messageKey) conditions.push(eq(t.message_key, filter.messageKey));
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
};
