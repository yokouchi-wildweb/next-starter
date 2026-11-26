// src/domains/core/messaging/entities/messageInboxItem/drizzle.ts

import { MessageDispatchTable } from "../messageDispatch/drizzle";
import { UserTable } from "@/domains/user/entities/drizzle";
import { index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
    // 要約の列(一覧・未読のモーダル・前の行の詳細が読む。title = 要約の題、body = 短い本文か本文、link = 行き先、image = 画像)
    title: text("title"),
    body: text("body").notNull(),
    link: text("link"),
    /** 画像（storage:// の参照） */
    image: text("image"),
    /** レイアウトの鍵(詳細がレイアウトのお知らせの描き方で描く、D121。記録の段が meta・秘密の連絡・前の行は null = 要約のカード) */
    layout: text("layout"),
    /** 書いた時のレイアウトの版(読む時に改版の対応で今の版へ読み替える) */
    layout_version: integer("layout_version"),
    /** レイアウトの欄の中身(差し込み済み、お知らせの送信チャンネルで使う欄だけ。秘密の値は空の字) */
    values: jsonb("values").$type<Record<string, unknown>>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    published_at: timestamp("published_at", { withTimezone: true }).notNull(),
    /** 間引きの鍵(throttle のある連絡の受信者ごとの行だけ。共有の行は null) */
    throttle_key: text("throttle_key"),
    /** まとめた回数(置き換えるたびに + 1) */
    collapsed_count: integer("collapsed_count").notNull().default(1),
    /** この行にまとめた前の送信(dispatch_id は最新の送信。FK なし: 保持の掃除で消えた送信も残る) */
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
