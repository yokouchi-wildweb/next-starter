// src/features/couponHistory/entities/drizzle.ts

import { index, jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

export const CouponHistoryTable = pgTable("coupon_histories", {
  id: uuid("id").defaultRandom().primaryKey(),
  coupon_id: uuid("coupon_id").notNull(),
  redeemer_user_id: uuid("redeemer_user_id"),
  metadata: jsonb("metadata").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  // 使用回数の確認（coupon_id + redeemer_user_id）と発行者別の集計（先頭の coupon_id）
  index("coupon_histories_coupon_id_redeemer_user_id_idx").on(table.coupon_id, table.redeemer_user_id),
]);
