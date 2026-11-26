// src/domains/core/messaging/entities/messageEndpoint/model.ts

import { MessageEndpointTable } from "./drizzle";

export type MessageEndpoint = typeof MessageEndpointTable.$inferSelect;
export type MessageEndpointInsert = typeof MessageEndpointTable.$inferInsert;
