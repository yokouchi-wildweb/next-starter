// src/features/referral/entities/drizzle.ts

import { pgEnum, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const ReferralStatusEnum = pgEnum("referral_status_enum", ["active", "cancelled"]);

export const ReferralTable = pgTable("referrals", {
  id: uuid("id").defaultRandom().primaryKey(),
  coupon_id: uuid("coupon_id").notNull(),
  inviter_user_id: uuid("inviter_user_id").notNull(),
  invitee_user_id: uuid("invitee_user_id").notNull(),
  status: ReferralStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  // 複合ユニーク制約 0: [invitee_user_id]
  uniqueIndex("referrals_composite_unique_0").on(table.invitee_user_id)
]);
