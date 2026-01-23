// src/features/couponHistory/entities/drizzle.ts

import { jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

export const CouponHistoryTable = pgTable("coupon_histories", {
  id: uuid("id").defaultRandom().primaryKey(),
  coupon_id: uuid("coupon_id").notNull(),
  redeemer_user_id: uuid("redeemer_user_id"),
  metadata: jsonb("metadata").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
