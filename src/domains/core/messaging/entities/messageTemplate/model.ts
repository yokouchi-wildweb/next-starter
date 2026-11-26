// src/domains/core/messaging/entities/messageTemplate/model.ts

import { MessageTemplateTable } from "./drizzle";

export type MessageTemplate = typeof MessageTemplateTable.$inferSelect;
export type MessageTemplateInsert = typeof MessageTemplateTable.$inferInsert;
