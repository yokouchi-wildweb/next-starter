// 生成物・編集不可: pnpm generate extensions が src/domains/core/messaging/extensionPoints.ts から生成する
// messagingLayoutEmails: 差す側の <ドメイン>/plugs/messagingLayouts/*/email.tsx(lib は <lib>/plugs/…)の export const emailRenderer(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { MessageLayoutEmailRenderer } from "@/lib/messaging";

import { emailRenderer as messagingLayoutEmails_messaging_alert } from "@/domains/core/messaging/plugs/messagingLayouts/alert/email";
import { emailRenderer as messagingLayoutEmails_messaging_link } from "@/domains/core/messaging/plugs/messagingLayouts/link/email";
import { emailRenderer as messagingLayoutEmails_messaging_notice } from "@/domains/core/messaging/plugs/messagingLayouts/notice/email";
import { emailRenderer as messagingLayoutEmails_messaging_simple } from "@/domains/core/messaging/plugs/messagingLayouts/simple/email";
import { emailRenderer as messagingLayoutEmails_messaging_statement } from "@/domains/core/messaging/plugs/messagingLayouts/statement/email";
import { emailRenderer as messagingLayoutEmails_messaging_welcome } from "@/domains/core/messaging/plugs/messagingLayouts/welcome/email";

export const messagingLayoutEmails: { domain: string | null; name: string; requires: readonly string[]; plug: MessageLayoutEmailRenderer & { folder: string } }[] = [
  { domain: "messaging", name: "alert", requires: [], plug: { ...messagingLayoutEmails_messaging_alert, folder: "alert" } },
  { domain: "messaging", name: "link", requires: [], plug: { ...messagingLayoutEmails_messaging_link, folder: "link" } },
  { domain: "messaging", name: "notice", requires: [], plug: { ...messagingLayoutEmails_messaging_notice, folder: "notice" } },
  { domain: "messaging", name: "simple", requires: [], plug: { ...messagingLayoutEmails_messaging_simple, folder: "simple" } },
  { domain: "messaging", name: "statement", requires: [], plug: { ...messagingLayoutEmails_messaging_statement, folder: "statement" } },
  { domain: "messaging", name: "welcome", requires: [], plug: { ...messagingLayoutEmails_messaging_welcome, folder: "welcome" } },
];
