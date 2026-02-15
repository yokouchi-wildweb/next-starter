// src/features/milestone/entities/drizzle.ts

import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const MilestoneTable = pgTable("milestones", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  milestone_key: text("milestone_key").notNull(),
  achieved_at: timestamp("achieved_at", { withTimezone: true }).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  // 複合ユニーク制約 0: [user_id, milestone_key]
  uniqueIndex("milestones_composite_unique_0").on(table.user_id, table.milestone_key)
]);
