// src/features/core/auth/messages/views/earlyRegistration.default.tsx
//
// 連絡 auth.earlyRegistration の既定の描き方。段落の並びは ../parts/LinkMailView.tsx(位置の約束)

import type { MessageEmailViewProps } from "@/lib/messaging";
import type { MailTheme } from "@/lib/mail";

import { LinkMailView } from "../parts/LinkMailView";

export function EmailView(props: MessageEmailViewProps<MailTheme>) {
  return <LinkMailView {...props} />;
}
