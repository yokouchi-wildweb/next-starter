// src/domains/core/messaging/entities/messageSubscriberFailure/model.ts

import { MessageSubscriberFailureTable } from "./drizzle";

export type MessageSubscriberFailure = typeof MessageSubscriberFailureTable.$inferSelect;
export type MessageSubscriberFailureInsert = typeof MessageSubscriberFailureTable.$inferInsert;
