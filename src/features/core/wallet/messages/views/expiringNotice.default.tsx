// src/features/core/wallet/messages/views/expiringNotice.default.tsx
//
// 連絡 wallet.expiringNotice の既定の描き方。段落の並びは ../parts/NoticeMailView.tsx(位置の約束)

import type { MessageEmailViewProps } from "@/lib/messaging";
import type { MailTheme } from "@/lib/mail";

import { NoticeMailView } from "../parts/NoticeMailView";

export function EmailView(props: MessageEmailViewProps<MailTheme>) {
  return <NoticeMailView {...props} />;
}
