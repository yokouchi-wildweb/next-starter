// src/features/core/user/messages/views/earlyRegistrationComplete.default.tsx
//
// 連絡 user.earlyRegistrationComplete の既定の描き方。段落の並びは ../parts/WelcomeMailView.tsx(位置の約束)

import type { MessageEmailViewProps } from "@/lib/messaging";
import type { MailTheme } from "@/lib/mail";

import { WelcomeMailView } from "../parts/WelcomeMailView";

export function EmailView(props: MessageEmailViewProps<MailTheme>) {
  return <WelcomeMailView {...props} />;
}
