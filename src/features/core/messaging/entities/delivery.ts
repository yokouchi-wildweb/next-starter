// src/features/core/messaging/entities/delivery.ts
//
// 配達（受信者 × 経路）と、provider から届いた事件（追記だけ）。
// - message_deliveries: 1 行 = 1 受信者 × 1 経路。複数の宛先は targets に持つ。
//   行の更新は排他（lease: locked_until + lock_token）。cron は next_attempt_at <= now で拾う
// - message_events: webhook の事件。UNIQUE(provider, provider_event_id) で重複を捨てる

import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { UserTable } from "@/features/user/entities/drizzle";

import { MessageDispatchTable } from "./drizzle";
import type { MessageDeliveryTarget } from "./schema";
import {
  MESSAGE_DELIVERY_REASONS,
  MESSAGE_DELIVERY_STATUSES,
} from "./schema";

export const MessageDeliveryTable = pgTable(
  "message_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dispatch_id: uuid("dispatch_id")
      .notNull()
      .references(() => MessageDispatchTable.id, { onDelete: "cascade" }),
    /** 受信者の鍵（user:<id> | addr:<hash>）。住所を消しても変わらない */
    recipient_key: text("recipient_key").notNull(),
    /** 利用者（宛先だけの送信と、利用者を消した後は null） */
    user_id: uuid("user_id").references(() => UserTable.id, {
      onDelete: "set null",
    }),
    /** 送った宛先（宛先が複数の経路は targets 側） */
    address: text("address"),
    channel: text("channel").notNull(),
    status: text("status")
      .$type<(typeof MESSAGE_DELIVERY_STATUSES)[number]>()
      .notNull()
      .default("queued"),
    /** 送らなかった理由（suppressed などのとき） */
    reason: text("reason").$type<(typeof MESSAGE_DELIVERY_REASONS)[number]>(),
    attempts: integer("attempts").notNull().default(0),
    /** 次に送り直す時刻（null = 送り直さない） */
    next_attempt_at: timestamp("next_attempt_at", { withTimezone: true }),
    /** lease: この時刻までは他の処理が行を取らない */
    locked_until: timestamp("locked_until", { withTimezone: true }),
    /** lease を取った処理の印 */
    lock_token: text("lock_token"),
    last_error: text("last_error"),
    provider: text("provider"),
    provider_message_id: text("provider_message_id"),
    /** 宛先ごとの状態（複数の宛先を持つ経路） */
    targets: jsonb("targets").$type<MessageDeliveryTarget[]>(),
    /** 受信者ごとの変数の写し（record が vars / full のとき。secret の印の鍵は落とす） */
    vars: jsonb("vars").$type<Record<string, unknown>>(),
    /** 受信者ごとの描いた本文（record が full のときだけ） */
    body: jsonb("body").$type<Record<string, unknown>>(),
    sent_at: timestamp("sent_at", { withTimezone: true }),
    delivered_at: timestamp("delivered_at", { withTimezone: true }),
    failed_at: timestamp("failed_at", { withTimezone: true }),
    /** 最初に開いた時刻 */
    opened_at: timestamp("opened_at", { withTimezone: true }),
    clicked_at: timestamp("clicked_at", { withTimezone: true }),
    complained_at: timestamp("complained_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_message_deliveries_recipient").on(
      table.dispatch_id,
      table.channel,
      table.recipient_key,
    ),
    index("idx_message_deliveries_status_next").on(
      table.status,
      table.next_attempt_at,
    ),
    index("idx_message_deliveries_provider_msg").on(
      table.provider,
      table.provider_message_id,
    ),
    index("idx_message_deliveries_user").on(table.user_id),
    index("idx_message_deliveries_created_at").on(table.createdAt),
  ],
);

export const MessageEventTable = pgTable(
  "message_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** 事件の配達（照合できなかった事件は null） */
    delivery_id: uuid("delivery_id").references(() => MessageDeliveryTable.id, {
      onDelete: "cascade",
    }),
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
  ],
);
