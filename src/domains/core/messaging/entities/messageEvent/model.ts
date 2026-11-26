// src/domains/core/messaging/entities/messageEvent/model.ts

import { MessageEventTable } from "./drizzle";

// lib/messaging の MessageEvent（受け口の型）と名前がぶつからないよう Row を付ける
export type MessageEventRow = typeof MessageEventTable.$inferSelect;
export type MessageEventRowInsert = typeof MessageEventTable.$inferInsert;
