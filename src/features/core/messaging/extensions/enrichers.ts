// 生成物・編集不可: pnpm generate extensions が src/features/core/messaging/extensionPoints.ts から生成する
// enrichers: src/features/core/messaging/enrichers/<名前>.ts(x) か <名前>/index.ts(x) の export const enricher(並びはファイル名の順)

import type { MessageEnricher } from "@/lib/messaging";

import { enricher as enrichers_displayName } from "@/features/core/messaging/enrichers/displayName";

const enrichersList: MessageEnricher[] = [
  enrichers_displayName,
];
export const enrichers: Readonly<Record<string, MessageEnricher>> = Object.assign(Object.create(null), Object.fromEntries(enrichersList.map((item) => [String(item.key), item])));
if (Object.keys(enrichers).length !== enrichersList.length) throw new Error("enrichers: key が重複している項目がある");
