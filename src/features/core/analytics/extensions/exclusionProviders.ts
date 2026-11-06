// 生成物・編集不可: pnpm generate extensions が src/features/core/analytics/extensionPoints.ts から生成する
// exclusionProviders: src/features/core/analytics/exclusionProviders/<名前>.ts(x) か <名前>/index.ts(x) の export const provider(並びはファイル名の順)

import type { AnalyticsExclusionProvider } from "@/features/core/analytics/services/server/exclusion/types";

const exclusionProvidersList: AnalyticsExclusionProvider[] = [];
export const exclusionProviders: Readonly<Record<string, AnalyticsExclusionProvider>> = Object.assign(Object.create(null), Object.fromEntries(exclusionProvidersList.map((item) => [String(item.key), item])));
if (Object.keys(exclusionProviders).length !== exclusionProvidersList.length) throw new Error("exclusionProviders: key が重複している項目がある");
