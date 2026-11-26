// src/domains/core/messaging/entities/messageEvent/drizzle.ts

import { MessageDeliveryTable } from "../messageDelivery/drizzle";
import { MessageDispatchTable } from "../messageDispatch/drizzle";
import { bigint, foreignKey, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const MessageEventTable = pgTable(
  "message_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** 事件の配達（照合できなかった事件は null） */
    delivery_id: uuid("delivery_id").references(() => MessageDeliveryTable.id, {
      onDelete: "cascade",
    }),
    /** 入った順の番号(購読の印。insert の時に決まり commit の順とは限らないので、cron は数分前までの行だけ読む) */
    seq: bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity(),
    /** 事件の送信(照合できなかった webhook の事件は null)。送信を消すと一緒に消える */
    dispatch_id: uuid("dispatch_id"),
    /** 送信の連絡の鍵(購読の絞り) */
    message_key: text("message_key"),
    /** 送信チャンネル(送信の事件は null) */
    channel: text("channel"),
    provider: text("provider").notNull(),
    /** 事件の種類（delivered / bounced / opened / clicked / complained など） */
    type: text("type").notNull(),
    occurred_at: timestamp("occurred_at", { withTimezone: true }).notNull(),
    provider_event_id: text("provider_event_id").notNull(),
    /** provider の事件の中身（秘密は入れない） */
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_message_events_provider_event").on(
      table.provider,
      table.provider_event_id,
    ),
    index("idx_message_events_delivery").on(table.delivery_id),
    index("idx_message_events_created_at").on(table.createdAt),
    index("idx_message_events_seq").on(table.seq),
    index("idx_message_events_dispatch").on(table.dispatch_id),
    foreignKey({
      name: "message_events_dispatch_fk",
      columns: [table.dispatch_id],
      foreignColumns: [MessageDispatchTable.id],
    }).onDelete("cascade"),
  ],
);
