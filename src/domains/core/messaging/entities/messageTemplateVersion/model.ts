// src/domains/core/messaging/entities/messageTemplateVersion/model.ts

import { MessageTemplateVersionTable } from "./drizzle";

export type MessageTemplateVersion =
  typeof MessageTemplateVersionTable.$inferSelect;
export type MessageTemplateVersionInsert =
  typeof MessageTemplateVersionTable.$inferInsert;
