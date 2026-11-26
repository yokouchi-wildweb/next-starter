// src/domains/core/userAcquisition/entities/userAcquisitionTouch/drizzle.ts

import type { AcquisitionExtras } from "../userAcquisition/model";
import { UserTable } from "@/domains/core/user/entities/drizzle";
import { index, jsonb, pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
