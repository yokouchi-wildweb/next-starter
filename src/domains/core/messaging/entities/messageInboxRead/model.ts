// src/domains/core/messaging/entities/messageInboxRead/model.ts

import { MessageInboxReadTable } from "./drizzle";

export type MessageInboxRead = typeof MessageInboxReadTable.$inferSelect;
export type MessageInboxReadInsert = typeof MessageInboxReadTable.$inferInsert;
