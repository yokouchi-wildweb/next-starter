// src/features/referralReward/entities/drizzle.ts

import { jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const ReferralRewardStatusEnum = pgEnum("referralReward_status_enum", ["pending", "fulfilled", "failed"]);

export const ReferralRewardTable = pgTable("referral_rewards", {
  id: uuid("id").defaultRandom().primaryKey(),
  referral_id: uuid("referral_id").notNull(),
  reward_key: text("reward_key").notNull(),
  recipient_user_id: uuid("recipient_user_id").notNull(),
  status: ReferralRewardStatusEnum("status").notNull().default("pending"),
  fulfilled_at: timestamp("fulfilled_at", { withTimezone: true }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  // 複合ユニーク制約 0: [referral_id, reward_key]
  uniqueIndex("referral_rewards_composite_unique_0").on(table.referral_id, table.reward_key)
]);
