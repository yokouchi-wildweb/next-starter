// src/features/messaging/services/server/index.ts

export { messagingService } from "./messagingService";
export type { MessagingService } from "./messagingService";

export { sendMessage, sendMessageToMany } from "./sendMessage";
export { continueSending, pruneMessagingRecords, runSendSweep } from "./sweep";
export { deleteEndpointsOfUser, listEndpoints, registerEndpoint, removeEndpoint } from "./endpoints";
export type { MessageEndpointDto, RegisterMessageEndpointInput } from "./endpoints";
export { inboxUnreadCount, listInbox, markAllInboxRead, markInboxRead } from "./inbox";
export type {
  AdminOverrideField,
  AdminOverrideMessageDetail,
  AdminOverrideMessageSummary,
  SaveMessageOverrideInput,
} from "./overrides";
export { deletePreferencesOfUser, getMessagePreferences, setMessagePreference } from "./preferences";
export type {
  MessagePreferenceCategoryDto,
  MessagePreferenceCellDto,
  MessagePreferenceChannelDto,
  MessagePreferencesDto,
  MessagePreferenceVia,
  SetMessagePreferenceInput,
} from "./preferences";
/** storage の照合(cron storage-sweep)へ渡すお知らせの画像の紐付け先の有無 */
export { existingDispatchIds } from "./inbox/dispatchRecords";
export { INBOX_IMAGE_RECORD_TYPE } from "./inbox/imageBinding";
/** storage の照合へ渡すテンプレートの画像の紐付け先の有無 */
export { existingTemplateIds, TEMPLATE_IMAGE_RECORD_TYPE } from "./templates";
export type {
  AdminTemplateDetail,
  AdminTemplatePage,
  AdminTemplateSummary,
  AdminTemplateVersion,
  CreateMessageTemplateInput,
  ListMessageTemplatesQuery,
  UpdateMessageTemplateInput,
} from "./templates";
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
