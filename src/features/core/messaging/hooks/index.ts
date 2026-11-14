// src/features/core/messaging/hooks/index.ts

export { MESSAGE_ENDPOINTS_KEY, useMessageEndpoints } from "./useMessageEndpoints";
export { INBOX_KEY, INBOX_UNREAD_COUNT_KEY } from "./inboxKeys";
export { useInboxItems, type UseInboxItemsOptions } from "./useInboxItems";
export { useInboxUnreadCount } from "./useInboxUnreadCount";
export { useMarkInboxItemRead } from "./useMarkInboxItemRead";
export { useMarkAllInboxRead } from "./useMarkAllInboxRead";
export { ADMIN_MESSAGING_KEY, ADMIN_DISPATCHES_KEY, adminDispatchKey } from "./adminMessagingKeys";
export { useAdminBulkSend, useAdminBulkSendOptions } from "./useAdminBulkSend";
export { useAdminDispatches, type UseAdminDispatchesOptions } from "./useAdminDispatches";
export { useAdminDispatch } from "./useAdminDispatch";
export { useAdminDispatchDeliveries, type UseAdminDispatchDeliveriesOptions } from "./useAdminDispatchDeliveries";
export {
  useAdminDispatchFilters,
  dispatchFilterStartOf,
  dispatchFilterNextDay,
} from "./useAdminDispatchFilters";
export { useAdminDispatchDetail, type UseAdminDispatchDetailOptions } from "./useAdminDispatchDetail";
export { useContinueDispatch } from "./useContinueDispatch";
export {
  MESSAGE_PREFERENCE_ALL,
  MESSAGE_PREFERENCES_KEY,
  preferenceCellKey,
  preferenceKindKey,
  useMessagePreferences,
} from "./useMessagePreferences";
export { MESSAGE_OVERRIDES_KEY, messageOverrideKey } from "./overrideKeys";
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
} from "./templateKeys";
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
export { useModalSession } from "./useModalSession";
export {
  useMessageTemplateForm,
  emptyChannelContent,
  contentForInput,
  type UseMessageTemplateFormOptions,
  type TemplateVariableDraft,
  type TemplateContentDraft,
} from "./useMessageTemplateForm";
export { ADMIN_SEND_KEY, ADMIN_SEND_OPTIONS_KEY } from "./sendKeys";
export { useAdminSendOptions } from "./useAdminSendOptions";
export {
  ADMIN_BULK_SEND_DEFAULT_CATEGORY,
  useMessageSendModal,
  templateVarsForInput,
  scheduleErrorOf,
  isBlankChannel,
  draftFromTemplate,
  initialDraftOf,
  initialAudienceOf,
  type MessageSendMode,
  type MessageSendDefaults,
  type MessageSendDraft,
  type MessageSendAudience,
  type MessageSendAudienceType,
  type MessageSendChannel,
  type MessageSendResult,
  type MessageSendStep,
  type MessageSendTemplate,
  type MessageSendModalState,
  type UseMessageSendModalOptions,
} from "./useMessageSendModal";
export { useCancelDispatch } from "./useCancelDispatch";
export { useRetractDispatch } from "./useRetractDispatch";
export { useResendDispatch } from "./useResendDispatch";
export { useInboxList, type UseInboxListOptions } from "./useInboxList";
export {
  INBOX_MODAL_CONFIRMED_IDS_KEY,
  isInboxModalPath,
  useInboxUnreadModal,
  type UseInboxUnreadModalOptions,
} from "./useInboxUnreadModal";
export { useUnsubscribe, type UnsubscribeStatus } from "./useUnsubscribe";
