// src/features/core/messaging/entities/template.ts
//
// 保存されたテンプレート（管理者が画面で書く連絡の中身）と、その版の履歴。
// - message_templates: 今の中身（下書き・公開・保管）
// - message_template_versions: 追記だけ。公開した版は不変。回は template_id + template_version で版を固定する
// 中身 = カテゴリー + ひな形 + 欄の中身 + 専用の埋め込み情報の宣言(指令 58、D113・D126)。経路は持たない: 送る経路は送る時のカテゴリーの経路の中の絞り。
// 版は保存の時の ひな形・ひな形の版・欄の中身・宣言 を持つ(ひな形を替えると中身は新しいひな形の物だけ、D113)

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

import type { MessageEmbeddedDeclaration } from "@/lib/messaging";

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
    category: text("category").notNull().default("promotion"),
    /** ひな形の鍵（messaging/layouts の受け口の管理者が選べる物） */
    layout: text("layout").notNull(),
    /** 保存した時のひな形の版（読む時に改版の対応で今の版へ読み替える） */
    layout_version: integer("layout_version").notNull().default(1),
    /** ひな形の欄の中身（{{鍵}} / {{別名}} のまま） */
    values: jsonb("values").$type<Record<string, unknown>>().notNull(),
    /** 専用の埋め込み情報の宣言（送る人が送る時に値を入れる） */
    embedded: jsonb("embedded")
      .$type<MessageEmbeddedDeclaration[]>()
      .notNull()
      .default([]),
    status: text("status")
      .$type<(typeof MESSAGE_TEMPLATE_STATUSES)[number]>()
      .notNull()
      .default("published"),
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
    layout: text("layout").notNull(),
    layout_version: integer("layout_version").notNull().default(1),
    values: jsonb("values").$type<Record<string, unknown>>().notNull(),
    embedded: jsonb("embedded")
      .$type<MessageEmbeddedDeclaration[]>()
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
