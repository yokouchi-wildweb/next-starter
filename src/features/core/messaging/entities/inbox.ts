// src/features/core/messaging/entities/inbox.ts
//
// サービス内のお知らせ（受け取り箱）。
// - message_inbox_items: 中身が受信者に依らない全員・ロール宛ては 1 行を皆で読む（user_id null）、
//   差し込み・個人宛ては受信者ごとの行（同じ表）。回（dispatch）を消すと一緒に消える。
//   間引き（throttle）の行は未読の間、新しい回の中身に置き換わる（dispatch_id = 最新の回、前の回は collapsed_dispatch_ids）
// - message_inbox_reads: 個別の既読
// - message_inbox_read_states: 全既読のウォーターマーク（この時刻以前に公開された行は既読）

import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { UserTable } from "@/features/user/entities/drizzle";

import { MessageDispatchTable } from "./drizzle";

export const MessageInboxItemTable = pgTable(
  "message_inbox_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dispatch_id: uuid("dispatch_id")
      .notNull()
      .references(() => MessageDispatchTable.id, { onDelete: "cascade" }),
    /** 受信者（null = 全員・ロール宛ての共有の行） */
    user_id: uuid("user_id").references(() => UserTable.id, {
      onDelete: "cascade",
    }),
    /** 共有の行を見せるロール（null = 全員）。user_id がある行では使わない */
    target_roles: text("target_roles").array(),
    title: text("title"),
    body: text("body").notNull(),
    link: text("link"),
    /** 画像（storage:// の参照） */
    image: text("image"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    published_at: timestamp("published_at", { withTimezone: true }).notNull(),
    /** 間引きの鍵(throttle のある連絡の受信者ごとの行だけ。共有の行は null) */
    throttle_key: text("throttle_key"),
    /** まとめた回数(置き換えるたびに + 1) */
    collapsed_count: integer("collapsed_count").notNull().default(1),
    /** この行にまとめた前の回(dispatch_id は最新の回。FK なし: 保持の掃除で消えた回も残る) */
    collapsed_dispatch_ids: uuid("collapsed_dispatch_ids").array(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_message_inbox_items_user_published").on(
      table.user_id,
      table.published_at,
    ),
    index("idx_message_inbox_items_published_id").on(
      table.published_at,
      table.id,
    ),
    index("idx_message_inbox_items_dispatch").on(table.dispatch_id),
    // 間引き: 同じ鍵の未読の行を引く
    index("idx_message_inbox_items_user_throttle").on(
      table.user_id,
      table.throttle_key,
    ),
  ],
);

export const MessageInboxReadTable = pgTable(
  "message_inbox_reads",
  {
    item_id: uuid("item_id")
      .notNull()
      .references(() => MessageInboxItemTable.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" }),
    read_at: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.item_id, table.user_id] }),
    index("idx_message_inbox_reads_user").on(table.user_id),
  ],
);

export const MessageInboxReadStateTable = pgTable("message_inbox_read_states", {
  user_id: uuid("user_id")
    .primaryKey()
    .references(() => UserTable.id, { onDelete: "cascade" }),
  /** この時刻以前に公開された行は既読。null = 全既読を一度もしていない */
  read_watermark_at: timestamp("read_watermark_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
