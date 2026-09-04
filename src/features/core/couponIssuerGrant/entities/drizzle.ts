// src/features/core/couponIssuerGrant/entities/drizzle.ts

import { index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { UserTable } from "@/features/core/user/entities/drizzle";
import { COUPON_ISSUER_GRANT_STATUSES } from "@/features/core/couponIssuerGrant/constants";

export const CouponIssuerGrantStatusEnum = pgEnum(
  "coupon_issuer_grant_status",
  COUPON_ISSUER_GRANT_STATUSES,
);

/**
 * coupon_issuer_grants
 *
 * 「クーポンを自分で発行してよい」権利の台帳。ユーザーにつき 1 行（申請 → 審査 → 発行可）。
 * settings は下流固有の per-user パラメータ（割引率・報酬率・月間上限など）を不透明な
 * jsonb として保持する。Tier1 はキーの意味を解釈しない（解釈は registry の program 設定が行う）。
 */
export const CouponIssuerGrantTable = pgTable(
  "coupon_issuer_grants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" }),
    status: CouponIssuerGrantStatusEnum("status").notNull().default("pending"),
    /** per-user パラメータ（下流定義。Tier1 は不透明扱い） */
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
    /** 申請時のユーザー入力（自己紹介・媒体 URL 等。下流定義、任意） */
    application: jsonb("application").$type<Record<string, unknown>>().notNull().default({}),
    requested_at: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    reviewed_at: timestamp("reviewed_at", { withTimezone: true }),
    reviewed_by: uuid("reviewed_by").references(() => UserTable.id, { onDelete: "set null" }),
    /** 管理者メモ（本人には返さない） */
    admin_note: text("admin_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("coupon_issuer_grants_user_uniq").on(table.user_id),
    index("coupon_issuer_grants_status_requested_idx").on(table.status, table.requested_at),
  ],
);
