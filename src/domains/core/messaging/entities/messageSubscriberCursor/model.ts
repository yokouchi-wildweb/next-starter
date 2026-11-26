// src/domains/core/messaging/entities/messageSubscriberCursor/model.ts

import { MessageSubscriberCursorTable } from "./drizzle";

export type MessageSubscriberCursor = typeof MessageSubscriberCursorTable.$inferSelect;
