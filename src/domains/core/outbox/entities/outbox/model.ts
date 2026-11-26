// src/domains/core/outbox/entities/outbox/model.ts

import type { OutboxJobTable } from "./drizzle";

/** 送り箱の行 */
export type OutboxJobRow = typeof OutboxJobTable.$inferSelect;

/** 行の状態 */
export type OutboxJobStatus = OutboxJobRow["status"];
