// src/domains/core/messaging/entities/messageTemplateVersion/drizzle.ts

import { MessageTemplateTable } from "../messageTemplate/drizzle";
import type { MessageVarDeclaration } from "@/lib/messaging";
import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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
    vars: jsonb("vars")
      .$type<MessageVarDeclaration[]>()
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
