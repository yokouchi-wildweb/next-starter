// src/features/rateLimit/entities/drizzle.ts

import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const RateLimitTable = pgTable("rate_limits", {
  id: text("id").primaryKey(),
  count: integer("count").notNull().default(1),
  window_start: timestamp("window_start", { withTimezone: true }).notNull(),
  expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
});
