// src/features/core/messaging/messages/views/adminMessage.default.tsx
//
// 連絡 messaging.adminMessage の既定の描き方。段落の並びは ../parts/AnnouncementMailView.tsx(位置の約束)

import type { MessageEmailViewProps } from "@/lib/messaging";
import type { MailTheme } from "@/lib/mail";

import { AnnouncementMailView } from "../parts/AnnouncementMailView";

export function EmailView(props: MessageEmailViewProps<MailTheme>) {
  return <AnnouncementMailView {...props} />;
}
