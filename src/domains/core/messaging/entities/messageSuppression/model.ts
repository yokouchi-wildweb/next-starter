// src/domains/core/messaging/entities/messageSuppression/model.ts

import { MessageSuppressionTable } from "./drizzle";
import { MESSAGE_SUPPRESSION_REASONS } from "./schema";

export type MessageSuppressionReason =
  (typeof MESSAGE_SUPPRESSION_REASONS)[number];
export type MessageSuppression = typeof MessageSuppressionTable.$inferSelect;
export type MessageSuppressionInsert =
  typeof MessageSuppressionTable.$inferInsert;
