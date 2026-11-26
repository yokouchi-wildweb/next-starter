// src/domains/core/messaging/entities/messagePreference/model.ts

import { MessagePreferenceTable } from "./drizzle";

export type MessagePreference = typeof MessagePreferenceTable.$inferSelect;
export type MessagePreferenceInsert =
  typeof MessagePreferenceTable.$inferInsert;
