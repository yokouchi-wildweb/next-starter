// src/features/core/messaging/hooks/index.ts

export { MESSAGE_ENDPOINTS_KEY, useMessageEndpoints } from "./useMessageEndpoints";
export { INBOX_KEY, INBOX_UNREAD_COUNT_KEY } from "./inboxKeys";
export { useInboxItems, type UseInboxItemsOptions } from "./useInboxItems";
export { useInboxUnreadCount } from "./useInboxUnreadCount";
export { useMarkInboxItemRead } from "./useMarkInboxItemRead";
export { useMarkAllInboxRead } from "./useMarkAllInboxRead";
export { ADMIN_MESSAGING_KEY, ADMIN_DISPATCHES_KEY, adminDispatchKey } from "./adminMessagingKeys";
export { useAdminBulkSend } from "./useAdminBulkSend";
export { useAdminDispatches, type UseAdminDispatchesOptions } from "./useAdminDispatches";
export { useAdminDispatch } from "./useAdminDispatch";
export { useAdminDispatchDeliveries, type UseAdminDispatchDeliveriesOptions } from "./useAdminDispatchDeliveries";
export { useContinueDispatch } from "./useContinueDispatch";
export { useAdminBulkSendForm, type UseAdminBulkSendFormOptions, type AdminBulkSendDefaults, type AdminBulkSendKind } from "./useAdminBulkSendForm";
export {
  MESSAGE_PREFERENCE_ALL,
  MESSAGE_PREFERENCES_KEY,
  preferenceCellKey,
  useMessagePreferences,
} from "./useMessagePreferences";
