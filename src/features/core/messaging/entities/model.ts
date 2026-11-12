// src/features/messaging/entities/model.ts

import type { MessageDeliveryTable, MessageEventTable } from "./delivery";
import { MessageDispatchTable } from "./drizzle";
import type { MessageEndpointTable } from "./endpoint";
import type { MessageIdempotencyKeyTable } from "./idempotencyKey";
import type { MessageOverrideTable } from "./override";
import type {
  MessageInboxItemTable,
  MessageInboxReadStateTable,
  MessageInboxReadTable,
} from "./inbox";
import type {
  MessagePreferenceTable,
  MessageSuppressionTable,
} from "./preference";
import type {
  MESSAGE_DELIVERY_REASONS,
  MESSAGE_DELIVERY_STATUSES,
  MESSAGE_DISPATCH_STATUSES,
  MESSAGE_SUPPRESSION_REASONS,
  MESSAGE_TEMPLATE_STATUSES,
} from "./schema";
import type {
  MessageTemplateTable,
  MessageTemplateVersionTable,
} from "./template";

export type MessageDispatch = typeof MessageDispatchTable.$inferSelect;
export type MessageDispatchInsert = typeof MessageDispatchTable.$inferInsert;

/** 送信ジョブの状態（値の意味は schema.ts の MESSAGE_DISPATCH_STATUSES を参照） */
export type MessageDispatchStatus = (typeof MESSAGE_DISPATCH_STATUSES)[number];

export type MessageDeliveryStatus = (typeof MESSAGE_DELIVERY_STATUSES)[number];
export type MessageDeliveryReason = (typeof MESSAGE_DELIVERY_REASONS)[number];
export type MessageSuppressionReason =
  (typeof MESSAGE_SUPPRESSION_REASONS)[number];
export type MessageTemplateStatus = (typeof MESSAGE_TEMPLATE_STATUSES)[number];

export type MessageDelivery = typeof MessageDeliveryTable.$inferSelect;
export type MessageDeliveryInsert = typeof MessageDeliveryTable.$inferInsert;
// lib/messaging の MessageEvent（受け口の型）と名前がぶつからないよう Row を付ける
export type MessageEventRow = typeof MessageEventTable.$inferSelect;
export type MessageEventRowInsert = typeof MessageEventTable.$inferInsert;
export type MessageInboxItem = typeof MessageInboxItemTable.$inferSelect;
export type MessageInboxItemInsert = typeof MessageInboxItemTable.$inferInsert;
export type MessageInboxRead = typeof MessageInboxReadTable.$inferSelect;
export type MessageInboxReadInsert = typeof MessageInboxReadTable.$inferInsert;
export type MessageInboxReadState =
  typeof MessageInboxReadStateTable.$inferSelect;
export type MessageInboxReadStateInsert =
  typeof MessageInboxReadStateTable.$inferInsert;
export type MessageTemplate = typeof MessageTemplateTable.$inferSelect;
export type MessageTemplateInsert = typeof MessageTemplateTable.$inferInsert;
export type MessageTemplateVersion =
  typeof MessageTemplateVersionTable.$inferSelect;
export type MessageTemplateVersionInsert =
  typeof MessageTemplateVersionTable.$inferInsert;
export type MessagePreference = typeof MessagePreferenceTable.$inferSelect;
export type MessagePreferenceInsert =
  typeof MessagePreferenceTable.$inferInsert;
export type MessageSuppression = typeof MessageSuppressionTable.$inferSelect;
export type MessageSuppressionInsert =
  typeof MessageSuppressionTable.$inferInsert;
export type MessageEndpoint = typeof MessageEndpointTable.$inferSelect;
export type MessageEndpointInsert = typeof MessageEndpointTable.$inferInsert;
export type MessageIdempotencyKey =
  typeof MessageIdempotencyKeyTable.$inferSelect;
export type MessageIdempotencyKeyInsert =
  typeof MessageIdempotencyKeyTable.$inferInsert;

export type MessageOverrideRow = typeof MessageOverrideTable.$inferSelect;
export type MessageOverrideInsert = typeof MessageOverrideTable.$inferInsert;
