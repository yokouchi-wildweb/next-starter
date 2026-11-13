// src/features/core/messaging/entities/preference.ts
//
// 配信停止の表 2 つ（users に列を足さない）。
// - message_preferences: 利用者が止めた 種類 × 経路（止めた時だけ行。全体は MESSAGE_ALL '*'）。
//   kind が '*' でない行 = 種別まるごとの停止(kind X、category '*'、channel '*'。D71)。kind '*' の行は種類 × 経路の行(今までどおり)
//   一意は (user_id, category, channel, kind) の素の列の uniqueIndex(kind は NOT NULL の '*' の印。NULL と NULLS NOT DISTINCT は
//   drizzle-kit の push が往復しないので使わない)
// - message_suppressions: 宛先の停止（hard_bounce / complaint / one_click / manual）

import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { UserTable } from "@/features/user/entities/drizzle";

import { MESSAGE_SUPPRESSION_REASONS } from "./schema";

export const MessagePreferenceTable = pgTable(
  "message_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" }),
    /** 種類の鍵。'*' = すべての種類 */
    category: text("category").notNull(),
    /** 経路の鍵。'*' = すべての経路 */
    channel: text("channel").notNull(),
    /** 種別まるごとの停止の種別(利用者が止められる種別だけ)。'*' = 種別まるごとではない(種類 × 経路の行) */
    kind: text("kind").notNull().default("*"),
    opted_out_at: timestamp("opted_out_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** 止めた入口（好みの画面 user / ワンクリック one_click / 会員登録 signup など） */
    source: text("source").notNull(),
    /** 停止を結ぶ連絡の鍵(ワンクリックだけ。好みのページ・前に作ったトークンは null) */
    source_message_key: text("source_message_key"),
    /** 停止を結ぶ回(ワンクリックだけ)。FK なし: 回は保持の掃除で消えるが、停止の行は残す */
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
    /** 範囲。'*' = すべての種類、one_click は種類の鍵 */
    scope: text("scope").notNull().default("*"),
    source: text("source"),
    provider_event_id: text("provider_event_id"),
    /** 停止を結ぶ連絡の鍵(ワンクリックだけ。好みのページ・前に作ったトークンは null) */
    source_message_key: text("source_message_key"),
    /** 停止を結ぶ回(ワンクリックだけ)。FK なし: 回は保持の掃除で消えるが、停止の行は残す */
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
