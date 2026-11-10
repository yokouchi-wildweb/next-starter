// src/features/core/messaging/services/server/inbox/index.ts
//
// 受け取り箱の利用者の service の結び(本物の部品)。/api/me/messaging/inbox が呼ぶ。

import { createInboxService } from "./inboxService";
import { drizzleInboxStore } from "./store";

const service = createInboxService(drizzleInboxStore);

export const listInbox = service.listInbox;
export const inboxUnreadCount = service.inboxUnreadCount;
export const markInboxRead = service.markInboxRead;
export const markAllInboxRead = service.markAllInboxRead;

export { createInboxService, INBOX_DEFAULT_LIMIT, INBOX_MAX_LIMIT, type InboxService } from "./inboxService";
export type { InboxItemDto, InboxPage } from "./dto";
export type { InboxViewer } from "./visibility";
export type { InboxRow, InboxStore } from "./types";
