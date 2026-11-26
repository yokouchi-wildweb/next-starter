// src/domains/core/messaging/entities/messageInboxItem/model.ts

import { MessageInboxItemTable } from "./drizzle";

export type MessageInboxItem = typeof MessageInboxItemTable.$inferSelect;
export type MessageInboxItemInsert = typeof MessageInboxItemTable.$inferInsert;
