// src/domains/core/rateLimit/entities/drizzle.ts
// レート制限の数え(D24・D57)。
// - 固定の窓: 1 行 = id `<scope>:<identifier>`、窓の始まり window_start・終わり expires_at・回数 count
// - 滑る窓: bucket ごとに 1 行 = id `<scope>:<identifier>:<bucket の始まりの epoch 秒>`、window_start = bucket の始まり、
//   expires_at = bucket の始まり + 窓。判定は key の行のうち窓の内の count の和
// - key = `<scope>:<identifier>`(滑る窓の和を引く鍵。固定の行にも書く。前からの行は null のまま)

import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const RateLimitTable = pgTable(
  "rate_limits",
  {
    id: text("id").primaryKey(),
    key: text("key"),
    count: integer("count").notNull().default(1),
    window_start: timestamp("window_start", { withTimezone: true }).notNull(),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    // 滑る窓: key の窓の内の bucket の和
    index("rate_limits_key_window_idx").on(table.key, table.window_start),
  ],
);
