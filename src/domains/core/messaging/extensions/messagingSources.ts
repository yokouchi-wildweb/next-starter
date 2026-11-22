// 生成物・編集不可: pnpm generate extensions が src/domains/core/messaging/extensionPoints.ts から生成する
// messagingSources: 差す側の <ドメイン>/plugs/messagingSources/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const source(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { MessageSource } from "@/lib/messaging";

import { source as messagingSources_messaging_adminBulk } from "@/domains/core/messaging/plugs/messagingSources/adminBulk";
import { source as messagingSources_messaging_adminBulkTest } from "@/domains/core/messaging/plugs/messagingSources/adminBulkTest";
import { source as messagingSources_messaging_adminSend } from "@/domains/core/messaging/plugs/messagingSources/adminSend";
import { source as messagingSources_messaging_adminSendTest } from "@/domains/core/messaging/plugs/messagingSources/adminSendTest";
import { source as messagingSources_messaging_legacyNotification } from "@/domains/core/messaging/plugs/messagingSources/legacyNotification";

export const messagingSources: { domain: string | null; name: string; requires: readonly string[]; plug: MessageSource }[] = [
  { domain: "messaging", name: "adminBulk", requires: [], plug: messagingSources_messaging_adminBulk },
  { domain: "messaging", name: "adminBulkTest", requires: [], plug: messagingSources_messaging_adminBulkTest },
  { domain: "messaging", name: "adminSend", requires: [], plug: messagingSources_messaging_adminSend },
  { domain: "messaging", name: "adminSendTest", requires: [], plug: messagingSources_messaging_adminSendTest },
  { domain: "messaging", name: "legacyNotification", requires: [], plug: messagingSources_messaging_legacyNotification },
];
