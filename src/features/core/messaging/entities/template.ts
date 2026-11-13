// src/features/core/messaging/entities/template.ts
//
// 保存されたテンプレート（管理者が画面で書く連絡の中身）と、その版の履歴。
// - message_templates: 今の中身（下書き・公開・保管）
// - message_template_versions: 追記だけ。公開した版は不変。回は template_id + template_version で版を固定する
// 文言だけを持つ(D85): 経路は持たない(content の鍵 = 文言のある経路)。送る経路は送る時のカテゴリーの経路の中の絞り

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

import type { MessageContent } from "@/lib/messaging";

import type { MessageTemplateVariable } from "./schema";
import { MESSAGE_TEMPLATE_STATUSES } from "./schema";

export const MessageTemplateTable = pgTable(
  "message_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** テンプレートの鍵（一意） */
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    /** 種類の鍵（配信停止の単位） */
    category: text("category").notNull().default("marketing"),
    /** 経路ごとの欄（lib/messaging の MessageContent と同じ形。鍵 = 文言のある経路） */
    content: jsonb("content").$type<MessageContent>().notNull(),
    /** 送る時に入れる値と受信者ごとの値の宣言 */
    variables: jsonb("variables")
      .$type<MessageTemplateVariable[]>()
      .notNull()
      .default([]),
    status: text("status")
      .$type<(typeof MESSAGE_TEMPLATE_STATUSES)[number]>()
      .notNull()
      .default("draft"),
    /** 最新の版の番号（null = まだ版がない） */
    current_version: integer("current_version"),
    /** 作った人・直した人の actor_id */
    created_by: text("created_by"),
    updated_by: text("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_message_templates_key").on(table.key),
    index("idx_message_templates_status").on(table.status),
  ],
);

export const MessageTemplateVersionTable = pgTable(
  "message_template_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    template_id: uuid("template_id")
      .notNull()
      .references(() => MessageTemplateTable.id, { onDelete: "cascade" }),
    /** 版の番号（テンプレートごとに 1 から） */
    version: integer("version").notNull(),
    content: jsonb("content").$type<MessageContent>().notNull(),
    variables: jsonb("variables")
      .$type<MessageTemplateVariable[]>()
      .notNull()
      .default([]),
    category: text("category").notNull(),
    /** 版を作った人の actor_id */
    edited_by: text("edited_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_message_template_versions_version").on(
      table.template_id,
      table.version,
    ),
  ],
);
