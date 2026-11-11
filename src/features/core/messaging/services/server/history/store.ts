// src/features/core/messaging/services/server/history/store.ts
//
// 利用者ごとの履歴の DB(drizzle)。配達を回と結び、(created_at, id) の降順の keyset。
// 索引 idx_message_deliveries_user_created(user_id, created_at desc, id desc)で引く。本文・宛先の列は選ばない

import { and, desc, eq, lt, or, type SQL } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { MessageDeliveryTable } from "../../../entities/delivery";
import { MessageDispatchTable } from "../../../entities/drizzle";
import type { UserHistoryStore } from "./userHistory";

export const drizzleUserHistoryStore: UserHistoryStore = {
  async listUserDeliveries(userId, after, limit) {
    const d = MessageDeliveryTable;
    const m = MessageDispatchTable;
    const conditions: SQL[] = [eq(d.user_id, userId)];
    if (after) {
      conditions.push(or(lt(d.createdAt, after.createdAt), and(eq(d.createdAt, after.createdAt), lt(d.id, after.id)))!);
    }
    return db
      .select({
        delivery: { id: d.id, channel: d.channel, status: d.status, sent_at: d.sent_at, createdAt: d.createdAt },
        dispatch: {
          id: m.id,
          message_key: m.message_key,
          kind: m.kind,
          source: m.source,
          headings: m.headings,
          email_subject: m.email_subject,
          notification_title: m.notification_title,
        },
      })
      .from(d)
      .innerJoin(m, eq(d.dispatch_id, m.id))
      .where(and(...conditions))
      .orderBy(desc(d.createdAt), desc(d.id))
      .limit(limit);
  },
};
