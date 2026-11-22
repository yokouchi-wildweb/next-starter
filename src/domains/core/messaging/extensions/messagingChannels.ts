// 生成物・編集不可: pnpm generate extensions が src/domains/core/messaging/extensionPoints.ts から生成する
// messagingChannels: 差す側の <ドメイン>/plugs/messagingChannels/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const channel(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { MessageChannel } from "@/lib/messaging";

import { channel as messagingChannels_messaging_email } from "@/domains/core/messaging/plugs/messagingChannels/email";
import { channel as messagingChannels_messaging_inApp } from "@/domains/core/messaging/plugs/messagingChannels/inApp";
import { channel as messagingChannels_messaging_line } from "@/domains/core/messaging/plugs/messagingChannels/line";

export const messagingChannels: { domain: string | null; name: string; requires: readonly string[]; plug: MessageChannel }[] = [
  { domain: "messaging", name: "email", requires: [], plug: messagingChannels_messaging_email },
  { domain: "messaging", name: "inApp", requires: [], plug: messagingChannels_messaging_inApp },
  { domain: "messaging", name: "line", requires: [], plug: messagingChannels_messaging_line },
];
