// src/features/core/messaging/entities/subscriber.ts
//
// 購読(messaging/subscribers の項目)の cron の状態(D47)。
// - message_subscriber_cursors: 購読ごとの印(どこまで渡したか = message_events.seq)。進めるのは単調(GREATEST)
// - message_subscriber_failures: 購読 × 事件の失敗の数。上限で隔離(quarantined_at)して印を進める。再処理の関数が読む。
//   事件が保持の掃除で消えると一緒に消える

import {
  bigint,
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { MessageEventTable } from "./delivery";

export const MessageSubscriberCursorTable = pgTable("message_subscriber_cursors", {
  /** 購読の鍵 */
  subscriber_key: text("subscriber_key").primaryKey(),
  /** 渡し終えた事件の seq(0 = まだ) */
  last_seq: bigint("last_seq", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const MessageSubscriberFailureTable = pgTable(
  "message_subscriber_failures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subscriber_key: text("subscriber_key").notNull(),
    event_id: uuid("event_id").notNull(),
    /** 失敗した回数 */
    attempts: integer("attempts").notNull().default(0),
    /** 最後の誤りの文(短く) */
    last_error: text("last_error"),
    /** 隔離した時刻(上限に達した。null = まだ次の実行で送り直す) */
    quarantined_at: timestamp("quarantined_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_message_subscriber_failures_key_event").on(table.subscriber_key, table.event_id),
    foreignKey({
      name: "message_subscriber_failures_event_fk",
      columns: [table.event_id],
      foreignColumns: [MessageEventTable.id],
    }).onDelete("cascade"),
  ],
);
