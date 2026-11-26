// src/domains/core/messaging/entities/messageTemplate/drizzle.ts

import type { MessageVarDeclaration } from "@/lib/messaging";
import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const MessageTemplateTable = pgTable(
  "message_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** テンプレートの鍵（一意） */
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    /** カテゴリーの鍵（配信停止の単位） */
    category: text("category").notNull().default("promotion"),
    /** レイアウトの鍵（点 messagingLayouts の管理者が選べる物） */
    layout: text("layout").notNull(),
    /** 保存した時のレイアウトの版（読む時に改版の対応で今の版へ読み替える） */
    layout_version: integer("layout_version").notNull().default(1),
    /** レイアウトの欄の中身（{{鍵}} / {{別名}} のまま） */
    values: jsonb("values").$type<Record<string, unknown>>().notNull(),
    /** 専用の埋め込み情報の宣言（送る人が送る時に値を入れる） */
    vars: jsonb("vars")
      .$type<MessageVarDeclaration[]>()
      .notNull()
      .default([]),
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
  ],
);
