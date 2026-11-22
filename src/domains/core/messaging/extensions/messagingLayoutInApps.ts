// 生成物・編集不可: pnpm generate extensions が src/domains/core/messaging/extensionPoints.ts から生成する
// messagingLayoutInApps: 差す側の <ドメイン>/plugs/messagingLayouts/*/inApp.tsx(lib は <lib>/plugs/…)の export const inAppRenderer(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { MessageLayoutInAppRenderer } from "@/lib/messaging";

import { inAppRenderer as messagingLayoutInApps_messaging_alert } from "@/domains/core/messaging/plugs/messagingLayouts/alert/inApp";
import { inAppRenderer as messagingLayoutInApps_messaging_link } from "@/domains/core/messaging/plugs/messagingLayouts/link/inApp";
import { inAppRenderer as messagingLayoutInApps_messaging_notice } from "@/domains/core/messaging/plugs/messagingLayouts/notice/inApp";
import { inAppRenderer as messagingLayoutInApps_messaging_simple } from "@/domains/core/messaging/plugs/messagingLayouts/simple/inApp";
import { inAppRenderer as messagingLayoutInApps_messaging_statement } from "@/domains/core/messaging/plugs/messagingLayouts/statement/inApp";
import { inAppRenderer as messagingLayoutInApps_messaging_welcome } from "@/domains/core/messaging/plugs/messagingLayouts/welcome/inApp";

export const messagingLayoutInApps: { domain: string | null; name: string; requires: readonly string[]; plug: MessageLayoutInAppRenderer & { folder: string } }[] = [
  { domain: "messaging", name: "alert", requires: [], plug: { ...messagingLayoutInApps_messaging_alert, folder: "alert" } },
  { domain: "messaging", name: "link", requires: [], plug: { ...messagingLayoutInApps_messaging_link, folder: "link" } },
  { domain: "messaging", name: "notice", requires: [], plug: { ...messagingLayoutInApps_messaging_notice, folder: "notice" } },
  { domain: "messaging", name: "simple", requires: [], plug: { ...messagingLayoutInApps_messaging_simple, folder: "simple" } },
  { domain: "messaging", name: "statement", requires: [], plug: { ...messagingLayoutInApps_messaging_statement, folder: "statement" } },
  { domain: "messaging", name: "welcome", requires: [], plug: { ...messagingLayoutInApps_messaging_welcome, folder: "welcome" } },
];
