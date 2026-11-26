// src/domains/core/messaging/entities/messageSuppression/drizzle.ts

import { MESSAGE_SUPPRESSION_REASONS } from "./schema";
import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const MessageSuppressionTable = pgTable(
  "message_suppressions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    channel: text("channel").notNull(),
    /** 正規化した宛先の sha256 */
    address_hash: text("address_hash").notNull(),
    reason: text("reason")
      .$type<(typeof MESSAGE_SUPPRESSION_REASONS)[number]>()
      .notNull(),
    /** 範囲。'*' = すべてのカテゴリー、one_click はカテゴリーの鍵 */
    scope: text("scope").notNull().default("*"),
    source: text("source"),
    provider_event_id: text("provider_event_id"),
    /** 停止を結ぶ連絡の鍵(ワンクリックだけ。好みのページ・前に作ったトークンは null) */
    source_message_key: text("source_message_key"),
    /** 停止を結ぶ送信(ワンクリックだけ)。FK なし: 送信は保持の掃除で消えるが、停止の行は残す */
    source_dispatch_id: uuid("source_dispatch_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_message_suppressions_channel_hash_scope").on(
      table.channel,
      table.address_hash,
      table.scope,
    ),
  ],
);
