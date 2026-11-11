// src/features/core/messaging/services/server/inbox/store.ts

import { and, count, desc, eq, inArray, not, sql } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { MessageDispatchTable } from "../../../entities/drizzle";
import { MessageInboxItemTable, MessageInboxReadStateTable, MessageInboxReadTable } from "../../../entities/inbox";
import { inboxBeforeSql } from "./cursorSql";
import { inboxReadSql, inboxSilentSql } from "./readState";
import type { InboxStore } from "./types";
import { inboxVisibilitySql } from "./visibility";

const I = MessageInboxItemTable;
const D = MessageDispatchTable;

export const drizzleInboxStore: InboxStore = {
  async list(viewer, { before, limit, unreadOnly }) {
    const read = inboxReadSql(viewer.userId);
    const conditions = [inboxVisibilitySql(viewer)];
    if (before) {
      conditions.push(inboxBeforeSql(before));
    }
    // 未読だけ(未読のモーダル)は静かな行を除く。ふつうの一覧には出す
    if (unreadOnly) conditions.push(not(read), not(inboxSilentSql()));
    const rows = await db
      .select({
        id: I.id,
        title: I.title,
        body: I.body,
        link: I.link,
        image: I.image,
        metadata: I.metadata,
        publishedAt: I.published_at,
        read,
      })
      .from(I)
      .innerJoin(D, eq(D.id, I.dispatch_id))
      .where(and(...conditions))
      .orderBy(desc(I.published_at), desc(I.id))
      .limit(limit);
    return rows.map((row) => ({ ...row, read: Boolean(row.read) }));
  },

  async countUnread(viewer) {
    const [row] = await db
      .select({ value: count() })
      .from(I)
      .innerJoin(D, eq(D.id, I.dispatch_id))
      .where(and(inboxVisibilitySql(viewer), not(inboxReadSql(viewer.userId)), not(inboxSilentSql())));
    return Number(row?.value ?? 0);
  },

  async isVisible(viewer, itemId) {
    const [row] = await db
      .select({ id: I.id })
      .from(I)
      .innerJoin(D, eq(D.id, I.dispatch_id))
      .where(and(eq(I.id, itemId), inboxVisibilitySql(viewer)))
      .limit(1);
    return Boolean(row);
  },

  async addRead(userId, itemId) {
    await db
      .insert(MessageInboxReadTable)
      .values({ item_id: itemId, user_id: userId })
      .onConflictDoNothing({ target: [MessageInboxReadTable.item_id, MessageInboxReadTable.user_id] });
  },

  async markAllRead(userId) {
    await db.transaction(async (tx) => {
      await tx
        .insert(MessageInboxReadStateTable)
        .values({ user_id: userId, read_watermark_at: sql`now()`, updatedAt: sql`now()` })
        .onConflictDoUpdate({
          target: MessageInboxReadStateTable.user_id,
          set: { read_watermark_at: sql`now()`, updatedAt: sql`now()` },
        });
      // watermark が覆う個別の既読の行を掃く(見える行は公開の時刻 ≤ 今なので、消しても既読のまま)
      await tx
        .delete(MessageInboxReadTable)
        .where(
          and(
            eq(MessageInboxReadTable.user_id, userId),
            inArray(
              MessageInboxReadTable.item_id,
              tx.select({ id: I.id }).from(I).where(sql`${I.published_at} <= now()`),
            ),
          ),
        );
    });
  },
};
