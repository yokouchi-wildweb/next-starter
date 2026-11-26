// src/domains/core/messaging/entities/messageIdempotencyKey/model.ts

import { MessageIdempotencyKeyTable } from "./drizzle";

export type MessageIdempotencyKey =
  typeof MessageIdempotencyKeyTable.$inferSelect;
export type MessageIdempotencyKeyInsert =
  typeof MessageIdempotencyKeyTable.$inferInsert;
