// src/features/messaging/services/server/index.ts

export { messagingService } from "./messagingService";
export type { MessagingService } from "./messagingService";

export { sendMessage, sendMessageToMany } from "./sendMessage";
export { continueSending, pruneMessagingRecords, runSendSweep } from "./sweep";
export { deleteEndpointsOfUser, listEndpoints, registerEndpoint, removeEndpoint } from "./endpoints";
export type { MessageEndpointDto, RegisterMessageEndpointInput } from "./endpoints";
export { inboxUnreadCount, listInbox, markAllInboxRead, markInboxRead } from "./inbox";
export type { InboxItemDto, InboxPage, InboxViewer } from "./inbox";
export type { UserMessageHistoryItem, UserMessageHistoryPage, UserMessageHistoryQuery } from "./history";
export type { ContinueSendingResult, RetentionResult, SendSweepResult } from "./sweep";
export type {
  MessageAudienceSpec,
  MessageDeliveryOutcome,
  MessageRecipient,
  SendMessageInput,
  SendMessageResult,
  SendMessageToManyInput,
} from "./sendMessage";
export type {
  AdminBulkSendCounts,
  AdminBulkSendInput,
  AdminBulkSendResult,
  AdminDeliveryRow,
  AdminDispatchDetail,
  AdminDispatchSummary,
  AdminMessageChannel,
  AdminMessageContent,
  AdminPage,
  ListDeliveriesQuery,
  ListDispatchesQuery,
  MessageBulkSendTarget,
} from "./admin";
