// src/features/coupon/entities/drizzle.ts

import { integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const CouponTypeEnum = pgEnum("coupon_type_enum", ["official", "affiliate", "invite"]);
export const CouponStatusEnum = pgEnum("coupon_status_enum", ["active", "inactive"]);

export const CouponTable = pgTable("coupons", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull(),
  type: CouponTypeEnum("type").notNull().default("official"),
  status: CouponStatusEnum("status").notNull().default("active"),
  name: text("name").notNull(),
  description: text("description"),
  image_url: text("image_url"),
  admin_label: text("admin_label"),
  admin_note: text("admin_note"),
  valid_from: timestamp("valid_from", { withTimezone: true }),
  valid_until: timestamp("valid_until", { withTimezone: true }),
  max_total_uses: integer("max_total_uses"),
  max_uses_per_redeemer: integer("max_uses_per_redeemer"),
  current_total_uses: integer("current_total_uses").notNull().default(0),
  owner_id: uuid("owner_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  // 複合ユニーク制約 0: [code]
  uniqueIndex("coupons_composite_unique_0").on(table.code).where(sql`deleted_at IS NULL`)
]);
