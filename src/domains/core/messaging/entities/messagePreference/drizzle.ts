// src/domains/core/messaging/entities/messagePreference/drizzle.ts

import { UserTable } from "@/domains/user/entities/drizzle";
import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const MessagePreferenceTable = pgTable(
  "message_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" }),
    /** カテゴリーの鍵。'*' = すべてのカテゴリー */
    category: text("category").notNull(),
    /** 送信チャンネルの鍵。'*' = すべての送信チャンネル */
    channel: text("channel").notNull(),
    /** 種別まるごとの停止の種別(利用者が止められる種別だけ)。'*' = 種別まるごとではない(カテゴリー × 送信チャンネルの行) */
    kind: text("kind").notNull().default("*"),
    opted_out_at: timestamp("opted_out_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** 止めた入口（好みの画面 user / ワンクリック one_click / 会員登録 signup など） */
    source: text("source").notNull(),
    /** 停止を結ぶ連絡の鍵(ワンクリックだけ。好みのページ・前に作ったトークンは null) */
    source_message_key: text("source_message_key"),
    /** 停止を結ぶ送信(ワンクリックだけ)。FK なし: 送信は保持の掃除で消えるが、停止の行は残す */
    source_dispatch_id: uuid("source_dispatch_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_message_preferences_user_category_channel_kind").on(
      table.user_id,
      table.category,
      table.channel,
      table.kind,
    ),
  ],
);
