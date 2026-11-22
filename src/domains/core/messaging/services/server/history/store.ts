// src/domains/core/messaging/services/server/history/store.ts
//
// 利用者ごとの履歴の DB(drizzle)。本文・宛先の列は選ばない
// - 配達: 送信と結び、(created_at, id) の降順の keyset。索引 idx_message_deliveries_user_created(user_id, created_at desc, id desc)
// - 共有のお知らせ: user_id null の行を送信と結び、受け取り箱の規則 inboxVisibilitySql で見える物だけ、(published_at, id) の降順の keyset。
//   索引 idx_message_inbox_items_published_id(published_at, id)

import { and, desc, eq, isNull, lt, or, type SQL } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { UserTable } from "@/domains/core/user/entities/drizzle";

import { MessageDeliveryTable } from "../../../entities/delivery";
import { MessageDispatchTable } from "../../../entities/drizzle";
import { MessageInboxItemTable } from "../../../entities/inbox";
import { inboxVisibilitySql } from "../inbox/visibility";
import type { UserHistoryStore } from "./userHistory";

const dispatchColumns = () => {
  const m = MessageDispatchTable;
  return { id: m.id, message_key: m.message_key, kind: m.kind, source: m.source, headings: m.headings };
};

export const drizzleUserHistoryStore: UserHistoryStore = {
  async findViewer(userId) {
    const [row] = await db.select({ role: UserTable.role }).from(UserTable).where(eq(UserTable.id, userId)).limit(1);
    return row ? { userId, role: row.role } : null;
  },

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
        dispatch: dispatchColumns(),
      })
      .from(d)
      .innerJoin(m, eq(d.dispatch_id, m.id))
      .where(and(...conditions))
      .orderBy(desc(d.createdAt), desc(d.id))
      .limit(limit);
  },

  async listSharedInApp(viewer, after, limit) {
    const i = MessageInboxItemTable;
    const m = MessageDispatchTable;
    const conditions: SQL[] = [isNull(i.user_id), inboxVisibilitySql(viewer)];
    if (after) {
      conditions.push(or(lt(i.published_at, after.createdAt), and(eq(i.published_at, after.createdAt), lt(i.id, after.id)))!);
    }
    return db
      .select({ item: { id: i.id, published_at: i.published_at }, dispatch: dispatchColumns() })
      .from(i)
      .innerJoin(m, eq(i.dispatch_id, m.id))
      .where(and(...conditions))
      .orderBy(desc(i.published_at), desc(i.id))
      .limit(limit);
  },
};
