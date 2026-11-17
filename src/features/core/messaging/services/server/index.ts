// src/features/messaging/services/server/index.ts

export { messagingService } from "./messagingService";
export type { MessagingService } from "./messagingService";

export { sendMessage, sendMessageToMany, sendTemplateMessage } from "./sendMessage";
/** 管理者がその場で送れる種別(白紙のシステムテンプレートの種別)と受け口の検査 */
export { adminSendableKinds, checkSystemTemplates, isAdminSendableKind, TEMPLATE_MESSAGE_KEY } from "./sendMessage";
export { continueSending, pruneMessagingRecords, runSendSweep } from "./sweep";
/** 購読(cron messaging-subscribers と運用の再処理) */
export { reprocessQuarantinedEvents, runMessageSubscribers } from "./subscribers";
export type { ReprocessResult, SubscriberRunResult } from "./subscribers";
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
  MessagePreferenceCategoryStopDto,
  MessagePreferenceChannelDto,
  MessagePreferenceGroupDto,
  MessagePreferenceKindDto,
  MessagePreferenceKindFrameDto,
  MessagePreferencesDto,
  MessagePreferenceVia,
  SetMessagePreferenceInput,
  SetMessagePreferenceOptions,
} from "./preferences";
/** storage の照合(cron storage-sweep)へ渡すお知らせの画像の紐付け先の有無 */
export { existingDispatchIds } from "./inbox/dispatchRecords";
export { INBOX_IMAGE_RECORD_TYPE } from "./inbox/imageBinding";
/** storage の照合へ渡すテンプレートの画像の紐付け先の有無 */
export { existingTemplateIds, TEMPLATE_IMAGE_RECORD_TYPE } from "./templates";
/** storage の照合へ渡す文言の上書きの画像の紐付け先の有無 */
export { existingOverrideIds, OVERRIDE_IMAGE_RECORD_TYPE } from "./overrides";
export type {
  AdminTemplateDetail,
  AdminTemplatePage,
  AdminTemplateSummary,
  AdminTemplateVersion,
  CreateMessageTemplateInput,
  ListMessageTemplatesQuery,
  UpdateMessageTemplateInput,
} from "./templates";
export type { InboxItemDetailDto, InboxItemDto, InboxPage, InboxViewer } from "./inbox";
export type { UserMessageHistoryItem, UserMessageHistoryPage, UserMessageHistoryQuery } from "./history";
export type { ContinueSendingResult, RetentionResult, SendSweepResult } from "./sweep";
export type {
  MessageTargetSpec,
  MessageDeliveryOutcome,
  MessageRecipient,
  SendMessageInput,
  SendMessageResult,
  SendMessageToManyInput,
} from "./sendMessage";
export type {
  AdminSendEstimateInput,
  AdminSendInput,
  AdminSendOptions,
  AdminSendPreviewInput,
  AdminSendResult,
  AdminSendTestInput,
} from "./admin";
export type { MessagePreview, MessageTemplateRef, RecipientEstimate, SendTemplateMessageInput } from "./sendMessage";
export type {
  AdminBulkDeleteResult,
  AdminDeleteResult,
  AdminDeleteSummary,
  AdminResendResult,
  DispatchOperationFlag,
  DispatchOperationFlags,
  DispatchOperationReason,
} from "./admin";
export type {
  AdminBulkSendCounts,
  AdminBulkSendInput,
  AdminBulkSendOptions,
  AdminBulkSendResult,
  AdminBulkSendTemplate,
  AdminFreeTextCategoryOption,
  AdminDeliveryRow,
  AdminDispatchDetail,
  AdminDispatchSummary,
  AdminMessageContent,
  AdminPage,
  ListDeliveriesQuery,
  ListDispatchesQuery,
  MessageBulkSendTarget,
} from "./admin";
