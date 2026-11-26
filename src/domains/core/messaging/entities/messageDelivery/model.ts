// src/domains/core/messaging/entities/messageDelivery/model.ts

import { MessageDeliveryTable } from "./drizzle";
import { MESSAGE_DELIVERY_REASONS, MESSAGE_DELIVERY_STATUSES } from "./schema";

export type MessageDeliveryStatus = (typeof MESSAGE_DELIVERY_STATUSES)[number];
export type MessageDeliveryReason = (typeof MESSAGE_DELIVERY_REASONS)[number];
export type MessageDelivery = typeof MessageDeliveryTable.$inferSelect;
export type MessageDeliveryInsert = typeof MessageDeliveryTable.$inferInsert;
