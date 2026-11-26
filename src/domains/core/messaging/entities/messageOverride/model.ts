// src/domains/core/messaging/entities/messageOverride/model.ts

import { MessageOverrideTable } from "./drizzle";

export type MessageOverrideRow = typeof MessageOverrideTable.$inferSelect;
export type MessageOverrideInsert = typeof MessageOverrideTable.$inferInsert;
