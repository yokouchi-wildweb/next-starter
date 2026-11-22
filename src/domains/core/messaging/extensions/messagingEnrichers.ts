// 生成物・編集不可: pnpm generate extensions が src/domains/core/messaging/extensionPoints.ts から生成する
// messagingEnrichers: 差す側の <ドメイン>/plugs/messagingEnrichers/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const enricher(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { MessageEnricher } from "@/lib/messaging";

import { enricher as messagingEnrichers_messaging_displayName } from "@/domains/core/messaging/plugs/messagingEnrichers/displayName";

export const messagingEnrichers: { domain: string | null; name: string; requires: readonly string[]; plug: MessageEnricher }[] = [
  { domain: "messaging", name: "displayName", requires: [], plug: messagingEnrichers_messaging_displayName },
];
