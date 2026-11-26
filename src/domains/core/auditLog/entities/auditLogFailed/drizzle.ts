// src/domains/core/auditLog/entities/auditLogFailed/drizzle.ts

import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * audit_logs 書き込みに失敗したレコードの退避先（dead-letter）。
 *
 * - bestEffort: true で記録された場合、insert 失敗時にここへ退避される
 * - parent tx の rollback と独立したトランザクションで書く（呼び出し側 tx 失敗の影響を受けない）
 * - 復旧スクリプトで定期的に再 insert を試みる運用を想定
 */
export const AuditLogFailedTable = pgTable(
  "audit_logs_failed",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    payload: jsonb("payload").notNull(),
    errorMessage: text("error_message"),
    errorStack: text("error_stack"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index("audit_logs_failed_created_at_idx").on(table.createdAt),
  }),
);
