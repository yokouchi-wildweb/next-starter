// src/features/core/userAcquisition/entities/drizzle.ts

import {
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { UserTable } from "@/features/core/user/entities/drizzle";

import type { AcquisitionExtras } from "./model";

/**
 * サインアップ流入経路のサマリー（ユーザーと 1:1）。
 *
 * first-touch / last-touch の集計軸（source / medium / campaign 等）を
 * 型付きカラムで非正規化して持ち、GROUP BY・インデックスが直接効くようにする。
 * ロングテール情報（utm_term / クリック ID / GA client_id 等）は extras(jsonb) に逃がし、
 * 集計軸に昇格したくなった値だけ将来カラム化する運用。
 *
 * 書き込みはサインアップ本登録時の 1 回のみ（再入会時は新しい獲得ジャーニーとして上書き）。
 * タッチ明細は user_acquisition_touches が持つ。
 */
export const UserAcquisitionTable = pgTable(
  "user_acquisitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => UserTable.id, { onDelete: "cascade" }),

    firstUtmSource: text("first_utm_source"),
    firstUtmMedium: text("first_utm_medium"),
    firstUtmCampaign: text("first_utm_campaign"),
    firstReferrerHost: text("first_referrer_host"),
    firstLandingPage: text("first_landing_page"),
    firstTouchAt: timestamp("first_touch_at", { withTimezone: true }).notNull(),

    lastUtmSource: text("last_utm_source"),
    lastUtmMedium: text("last_utm_medium"),
    lastUtmCampaign: text("last_utm_campaign"),
    lastReferrerHost: text("last_referrer_host"),
    lastLandingPage: text("last_landing_page"),
    lastTouchAt: timestamp("last_touch_at", { withTimezone: true }).notNull(),

    /** cookie に残っていたタッチ数（間引き後）。明細行数と一致する */
    touchCount: integer("touch_count").notNull(),
    signupAt: timestamp("signup_at", { withTimezone: true }).notNull(),

    /** GA client_id 等、集計軸にしないロングテール情報 */
    extras: jsonb("extras").$type<AcquisitionExtras>(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // 期間 × 流入元のサインアップ集計（WHERE signup_at BETWEEN ... GROUP BY first_utm_source 等）
    signupAtIdx: index("user_acquisitions_signup_at_idx").on(table.signupAt),
  }),
);

/**
 * サインアップまでの流入タッチ明細（ユーザーと 1:N、touch_index 昇順で時系列）。
 *
 * first / last 以外のタッチも保持することで、線形配分などの
 * アトリビューションモデルやタッチ経路（パス）分析を後から適用できる。
 */
export const UserAcquisitionTouchTable = pgTable(
  "user_acquisition_touches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" }),

    /** 0 始まりの時系列順。0 が first-touch */
    touchIndex: smallint("touch_index").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),

    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    referrerHost: text("referrer_host"),
    landingPage: text("landing_page"),

    /** utm_term / utm_content / クリック ID 等 */
    extras: jsonb("extras").$type<AcquisitionExtras>(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("user_acquisition_touches_user_idx").on(table.userId, table.touchIndex),
    // 期間指定でのタッチ集計（線形配分モデル等）
    occurredAtIdx: index("user_acquisition_touches_occurred_at_idx").on(table.occurredAt),
  }),
);
