// 生成物・編集不可: pnpm generate extensions が src/domains/core/messaging/extensionPoints.ts から生成する
// messagingLayouts: 差す側の <ドメイン>/plugs/messagingLayouts/*/layout.ts(lib は <lib>/plugs/…)の export const layout(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す。隣の <名前>.override.ts の disabled・adminSelectable を重ねる)

import type { MessageLayoutItem } from "@/lib/messaging";

import { layout as messagingLayouts_messaging_alert } from "@/domains/core/messaging/plugs/messagingLayouts/alert/layout";
import { layout as messagingLayouts_messaging_link } from "@/domains/core/messaging/plugs/messagingLayouts/link/layout";
import { layout as messagingLayouts_messaging_notice } from "@/domains/core/messaging/plugs/messagingLayouts/notice/layout";
import { layout as messagingLayouts_messaging_simple } from "@/domains/core/messaging/plugs/messagingLayouts/simple/layout";
import { layout as messagingLayouts_messaging_statement } from "@/domains/core/messaging/plugs/messagingLayouts/statement/layout";
import { layout as messagingLayouts_messaging_welcome } from "@/domains/core/messaging/plugs/messagingLayouts/welcome/layout";

export const messagingLayouts: { domain: string | null; name: string; requires: readonly string[]; plug: MessageLayoutItem & { folder: string } }[] = [
  { domain: "messaging", name: "alert", requires: [], plug: { ...messagingLayouts_messaging_alert, folder: "alert" } },
  { domain: "messaging", name: "link", requires: [], plug: { ...messagingLayouts_messaging_link, folder: "link" } },
  { domain: "messaging", name: "notice", requires: [], plug: { ...messagingLayouts_messaging_notice, folder: "notice" } },
  { domain: "messaging", name: "simple", requires: [], plug: { ...messagingLayouts_messaging_simple, folder: "simple" } },
  { domain: "messaging", name: "statement", requires: [], plug: { ...messagingLayouts_messaging_statement, folder: "statement" } },
  { domain: "messaging", name: "welcome", requires: [], plug: { ...messagingLayouts_messaging_welcome, folder: "welcome" } },
];
