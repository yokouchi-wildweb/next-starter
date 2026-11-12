// src/features/core/messaging/entities/override.ts
//
// 管理画面の文言の上書き(D21・D24・D28)。直した欄だけ行がある(1 行 = 連絡 × 欄)。
// - field_path = "<経路>.<欄>"(定義の adminEditable と同じ書き方)
// - value = 管理者が書いた値 / code_value = 直した時のコードの値(fork の override を重ねた後)。今のコードの値と違えば「コードが変わった」
// - 既定に戻す = 行を消す。定義の鍵はコードなので外部キーは持たない

import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { UserTable } from "@/features/user/entities/drizzle";

export const MessageOverrideTable = pgTable(
  "message_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** 連絡の鍵(<domain>.<name>) */
    message_key: text("message_key").notNull(),
    /** 欄("<経路>.<欄>") */
    field_path: text("field_path").notNull(),
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
