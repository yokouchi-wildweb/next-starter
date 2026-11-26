// src/domains/core/messaging/entities/messageDispatchRecipient/model.ts

import { MessageDispatchRecipientTable } from "./drizzle";

export type MessageDispatchRecipient = typeof MessageDispatchRecipientTable.$inferSelect;
export type MessageDispatchRecipientInsert = typeof MessageDispatchRecipientTable.$inferInsert;
