// src/domains/core/messaging/services/server/history/store.ts
//
// 利用者ごとの履歴の DB(drizzle)。本文・宛先の列は選ばない
// - 送信: その利用者の配達を送信ごとにまとめ(時刻 = 最後の配達の created_at)、(時刻, 送信の id) の降順の keyset で送信を選び、
//   選んだ送信のこの利用者への配達を作った順に結ぶ。索引 idx_message_deliveries_user_created(user_id, created_at desc, id desc)で
//   その利用者の配達だけを読む(保持の掃除 retention.deliveriesDays が量を区切る)
// - 共有のお知らせ: user_id null の行を送信と結び、受け取り箱の規則 inboxVisibilitySql で見える物だけ、(published_at, id) の降順の keyset。
//   索引 idx_message_inbox_items_published_id(published_at, id)
// - sentBy: admin = 送信の actor_type が admin / system = それ以外(null を含む)。送信の一覧の手動送信 / 自動送信の切り替え(D210)と同じ線(dispatchSentBySql)
// - 時刻は raw sql に JS の Date を渡さない(ISO の文字列で渡す。messaging の raw sql の決まり)

import { and, asc, desc, eq, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { UserTable } from "@/domains/core/user/entities/drizzle";

import { MessageDeliveryTable } from "../../../entities/delivery";
import { MessageDispatchTable } from "../../../entities/drizzle";
import { MessageInboxItemTable } from "../../../entities/inbox";
import { dispatchSentBySql } from "../dispatchSentBy";
import { inboxVisibilitySql } from "../inbox/visibility";
import type { UserHistoryStore } from "./userHistory";

const dispatchColumns = () => {
  const m = MessageDispatchTable;
  return {
    id: m.id,
    message_key: m.message_key,
    kind: m.kind,
    source: m.source,
    headings: m.headings,
    actor_id: m.actor_id,
    actor_type: m.actor_type,
    reason: m.reason,
  };
};

export const drizzleUserHistoryStore: UserHistoryStore = {
  async findViewer(userId) {
    const [row] = await db.select({ role: UserTable.role }).from(UserTable).where(eq(UserTable.id, userId)).limit(1);
    return row ? { userId, role: row.role } : null;
  },

  async listUserDispatches(userId, after, limit, sentBy) {
    const d = MessageDeliveryTable;
    const m = MessageDispatchTable;
    // 印は JS の Date(ミリ秒)で往復するので、並びの時刻もミリ秒に切って比べる(マイクロ秒の差で行が重なり・抜けしない)
    const at = sql<string>`date_trunc('milliseconds', max(${d.createdAt}))`;
    const filters = [eq(d.user_id, userId), dispatchSentBySql(sentBy)].filter((c): c is SQL => c !== undefined);
    const having = after
      ? sql`(${at} < ${after.createdAt.toISOString()}::timestamptz OR (${at} = ${after.createdAt.toISOString()}::timestamptz AND ${d.dispatch_id} < ${after.id}))`
      : undefined;
    const picked = await db
      .select({ dispatchId: d.dispatch_id, at })
      .from(d)
      .innerJoin(m, eq(d.dispatch_id, m.id))
      .where(and(...filters))
      .groupBy(d.dispatch_id)
      .having(having)
      .orderBy(desc(at), desc(d.dispatch_id))
      .limit(limit);
    const ids = picked.map((row) => row.dispatchId).filter((id): id is string => id !== null);
    if (ids.length === 0) return [];
    const [dispatches, deliveries] = await Promise.all([
      db.select(dispatchColumns()).from(m).where(inArray(m.id, ids)),
      db
        .select({ dispatchId: d.dispatch_id, id: d.id, channel: d.channel, status: d.status, sent_at: d.sent_at, createdAt: d.createdAt })
        .from(d)
        .where(and(eq(d.user_id, userId), inArray(d.dispatch_id, ids)))
        .orderBy(asc(d.createdAt), asc(d.id)),
    ]);
    const dispatchById = new Map(dispatches.map((row) => [row.id, row]));
    return picked.flatMap((row) => {
      const dispatch = row.dispatchId ? dispatchById.get(row.dispatchId) : undefined;
      if (!dispatch) return [];
      return [
        {
          at: new Date(row.at),
          dispatch,
          deliveries: deliveries
            .filter((delivery) => delivery.dispatchId === dispatch.id)
            .map(({ dispatchId: _dispatchId, ...delivery }) => delivery),
        },
      ];
    });
  },

  async listSharedInApp(viewer, after, limit, sentBy) {
    const i = MessageInboxItemTable;
    const m = MessageDispatchTable;
    const conditions = [isNull(i.user_id), inboxVisibilitySql(viewer), dispatchSentBySql(sentBy)].filter((c): c is SQL => c !== undefined);
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
