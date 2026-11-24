// src/domains/core/messaging/hooks/index.ts

export { MESSAGE_ENDPOINTS_KEY } from "./messagingKeys";
export { useMessageEndpoints } from "./useMessageEndpoints";
export { INBOX_KEY, INBOX_UNREAD_COUNT_KEY } from "./messagingKeys";
export { useInboxItems, type UseInboxItemsOptions } from "./useInboxItems";
export { useInboxUnreadCount } from "./useInboxUnreadCount";
export { useMarkInboxItemRead } from "./useMarkInboxItemRead";
export { useMarkAllInboxRead } from "./useMarkAllInboxRead";
export { ADMIN_MESSAGING_KEY, ADMIN_DISPATCHES_KEY, ADMIN_DISPATCH_CATEGORIES_KEY, adminDispatchKey } from "./messagingKeys";
export { useAdminDispatchCategories } from "./useAdminDispatchCategories";
export { useAdminBulkSend, useAdminBulkSendOptions } from "./useAdminBulkSend";
export { useAdminDispatches, type UseAdminDispatchesOptions } from "./useAdminDispatches";
export { useAdminDispatch } from "./useAdminDispatch";
export { useAdminDispatchDeliveries, type UseAdminDispatchDeliveriesOptions } from "./useAdminDispatchDeliveries";
export {
  useAdminDispatchFilters,
  dispatchFilterStartOf,
  dispatchFilterNextDay,
  dispatchSubjectQueryOf,
  dispatchPeriodStartOf,
  DISPATCH_SUBJECT_QUERY_MAX,
  DISPATCH_SUBJECT_DEBOUNCE_MS,
  DISPATCH_PERIODS,
  type DispatchPeriod,
} from "./useAdminDispatchFilters";
export {
  useAdminDispatchFilterOptions,
  dispatchFilterOptionsOf,
  UNNAMED_SOURCE_LABEL,
  UNNAMED_ACTOR_LABEL,
  type AdminDispatchFilterOption,
} from "./useAdminDispatchFilterOptions";
export { ADMIN_DISPATCH_FILTER_OPTIONS_KEY } from "./messagingKeys";
export { useAdminDispatchDetail, type UseAdminDispatchDetailOptions } from "./useAdminDispatchDetail";
export {
  useScheduledEdit,
  scheduledEditInputOf,
  scheduledEditNote,
  scheduledEditChannelShape,
  sameChannelSet,
  type ScheduledEditChange,
  type ScheduledEditChannel,
  type ScheduledEditDispatch,
  type ScheduledEditFieldChange,
  type ScheduledEditState,
  type UseScheduledEditOptions,
} from "./useScheduledEdit";
export { useScheduledEditOptions } from "./useScheduledEditOptions";
export { scheduledEditOptionsKey } from "./messagingKeys";
export { useDispatchReaders, type UseDispatchReadersOptions } from "./useDispatchReaders";
export { useUserMessageHistory, type UseUserMessageHistoryOptions } from "./useUserMessageHistory";
export { useContinueDispatch } from "./useContinueDispatch";
export { MESSAGE_PREFERENCES_KEY } from "./messagingKeys";
export {
  MESSAGE_PREFERENCE_ALL,
  preferenceCellKey,
  preferenceKindKey,
  useMessagePreferences,
} from "./useMessagePreferences";
export { MESSAGE_OVERRIDES_KEY, messageOverrideKey } from "./messagingKeys";
export { useMessageOverrides } from "./useMessageOverrides";
export { useAdminMessageOverrideList } from "./useAdminMessageOverrideList";
export { useMessageOverride } from "./useMessageOverride";
export {
  useMessageOverrideEditor,
  toEditable,
  unknownKeysOf,
  type OverrideFieldValue,
} from "./useMessageOverrideEditor";
export {
  MESSAGE_TEMPLATES_KEY,
  MESSAGE_TEMPLATE_OPTIONS_KEY,
  messageTemplateKey,
  messageTemplateVersionsKey,
  messageTemplateVersionKey,
} from "./messagingKeys";
export { useMessageTemplates, type UseMessageTemplatesOptions } from "./useMessageTemplates";
export { useMessageTemplate, useMessageTemplateOptions } from "./useMessageTemplate";
export { useMessageTemplateVersions } from "./useMessageTemplateVersions";
export { useMessageTemplateVersion } from "./useMessageTemplateVersion";
export { useAdminMessageTemplateList, type UseAdminMessageTemplateListOptions } from "./useAdminMessageTemplateList";
export {
  useMessageTemplateModal,
  type MessageTemplateModalTab,
  type UseMessageTemplateModalOptions,
} from "./useMessageTemplateModal";
export {
  newTemplateLayoutOf,
  useMessageTemplateForm,
  type UseMessageTemplateFormOptions,
} from "./useMessageTemplateForm";
export { ADMIN_SEND_KEY, ADMIN_SEND_OPTIONS_KEY, ADMIN_DEFINITION_SEND_KEY, definitionOptionsKey, recipientChannelsKey } from "./messagingKeys";
// 送る画面の公開の hook(D191: 自由連絡の送るモーダル・定義連絡の汎用のモーダル・fork の自前の送る画面がこれだけで組む。二重送信の鍵を作る関数は出さない)
export { useSendSteps, type SendStep, type UseSendStepsOptions } from "./useSendSteps";
export { useIdempotencyKey } from "./useIdempotencyKey";
export { useSendPreview, type UseSendPreviewOptions } from "./useSendPreview";
export { useSendTest, type UseSendTestOptions } from "./useSendTest";
export { initialChannelsOff } from "./sendChannels";
export { useLayoutPreview, previewValuesOf, type LayoutPreviewMode, type UseLayoutPreviewOptions } from "./useLayoutPreview";
export { dispatchDetailHref } from "./useDispatchDetailParam";
export { useDefinitionSend, useDefinitionSendOptions, useDefinitionPreview, useDefinitionTest } from "./useDefinitionSend";
export {
  useDefinitionSendModal,
  definitionChannelsOf,
  broadcastTypesOf,
  changedEdits,
  type DefinitionSendEntry,
  type DefinitionSendTarget,
  type DefinitionSendTargetType,
  type DefinitionSendChannel,
  type DefinitionSendModalState,
  type UseDefinitionSendModalOptions,
} from "./useDefinitionSendModal";
export { useSendResults, type UseSendResultsOptions } from "./useSendResults";
export { useRecipientChannels } from "./useRecipientChannels";
export { useAdminSendOptions } from "./useAdminSendOptions";
export { useRecipientEstimate, overLimitText, type UseRecipientEstimateOptions } from "./useRecipientEstimate";
export {
  useMessageSendModal,
  scheduleErrorOf,
  kindsOf,
  blankLayoutOf,
  initialTextOf,
  initialTargetOf,
  sameAsNoteOf,
  TARGET_GROUP_GONE_NOTE,
  type MessageSendMode,
  type MessageSendTarget,
  type MessageSendTargetType,
  type MessageSendResult,
  type MessageSendTemplate,
  type MessageSendModalState,
  type UseMessageSendModalOptions,
} from "./useMessageSendModal";
export {
  useSendTemplateText,
  layoutTextState,
  templateTextState,
  varValuesForInput,
  missingVars,
  type SendTextSource,
  type SendTextState,
  type SendTemplateTextState,
  type UseSendTemplateTextOptions,
} from "./useSendTemplateText";
export { useDeleteDispatch } from "./useDeleteDispatch";
export { useResendDispatch } from "./useResendDispatch";
export { useInboxList, type UseInboxListOptions } from "./useInboxList";
export {
  INBOX_MODAL_CONFIRMED_IDS_KEY,
  isInboxModalPath,
  useInboxUnreadModal,
  type UseInboxUnreadModalOptions,
} from "./useInboxUnreadModal";
export { useUnsubscribe, type UnsubscribeStatus } from "./useUnsubscribe";
export { useCopyMessageVariable } from "./useCopyMessageVariable";
export { useLayoutFieldsForm, layoutFieldsDefaults, type LayoutFieldsValues, type UseLayoutFieldsFormOptions } from "./useLayoutFieldsForm";
export { useVarTags, type UseVarTagsOptions } from "./useVarTags";
export { DISPATCH_DELETE_MAX, useBulkDeleteDispatches } from "./useBulkDeleteDispatches";
export { useDispatchDeleteSummary } from "./useDispatchDeleteSummary";
