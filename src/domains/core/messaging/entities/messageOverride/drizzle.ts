// src/domains/core/messaging/entities/messageOverride/drizzle.ts

import { UserTable } from "@/domains/user/entities/drizzle";
import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const MessageOverrideTable = pgTable(
  "message_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** 連絡の鍵(<domain>.<name>) */
    message_key: text("message_key").notNull(),
    /** 欄(レイアウトの欄の鍵。保存した時の版の鍵のまま) */
    field_path: text("field_path").notNull(),
    /** 保存した時のレイアウトの版(null = 版の無い古い形の行 = 使えない) */
    layout_version: integer("layout_version"),
    /** 管理者が書いた値 */
    value: jsonb("value").$type<unknown>().notNull(),
    /** 直した時のコードの値(コードが変わったかの印に使う) */
    code_value: jsonb("code_value").$type<unknown>(),
    /** 最後に直した管理者(消えれば null) */
    updated_by: uuid("updated_by").references(() => UserTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_message_overrides_key_path").on(table.message_key, table.field_path),
  ],
);
