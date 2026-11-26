// src/domains/core/messaging/entities/messageInboxReadState/model.ts

import { MessageInboxReadStateTable } from "./drizzle";

export type MessageInboxReadState =
  typeof MessageInboxReadStateTable.$inferSelect;
export type MessageInboxReadStateInsert =
  typeof MessageInboxReadStateTable.$inferInsert;
