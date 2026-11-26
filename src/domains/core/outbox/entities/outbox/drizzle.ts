// src/domains/core/outbox/entities/outbox/drizzle.ts
// 送り箱の表(D52、設計: docs/journal/2026-11-24--next-starter--outbox-engine-choice.md の 3)。
// - 業務の更新と同じ取引で 1 行積み(enqueueOutbox)、コミットの後に押す(kickOutbox)か定期処理が届ける
// - status: pending(待ち・保留)→ running(貸し中、lease_until まで)→ done / quarantined(上限で隔離、消さない)
// - (kind, idempotency_key) の重複は積まない。payload は版の欄 v を持つ JSON(秘密を入れない)
// - 機能の規則 outbox が閉じている間は push の対象の外(src/featureGate/node/gatedSchema.ts)

import type { OutboxKind } from "../../points";
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const OutboxJobTable = pgTable(
  "outbox_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: text("kind").$type<OutboxKind>().notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    idempotency_key: text("idempotency_key").notNull(),
    status: text("status").$type<"pending" | "running" | "done" | "quarantined">().notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    next_attempt_at: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    lease_until: timestamp("lease_until", { withTimezone: true }),
    last_error: text("last_error"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    done_at: timestamp("done_at", { withTimezone: true }),
    quarantined_at: timestamp("quarantined_at", { withTimezone: true }),
  },
  (table) => [
    // 同じ kind と冪等の鍵は 1 行(積む側の重複を止める)
    uniqueIndex("outbox_jobs_kind_key_unique").on(table.kind, table.idempotency_key),
    // 取る順: 時の来た待ちを古い順に
    index("outbox_jobs_status_next_idx").on(table.status, table.next_attempt_at),
    // 監視: kind ごとの状態の数
    index("outbox_jobs_kind_status_idx").on(table.kind, table.status),
  ],
);
