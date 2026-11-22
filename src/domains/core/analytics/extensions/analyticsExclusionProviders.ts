// 生成物・編集不可: pnpm generate extensions が src/domains/core/analytics/extensionPoints.ts から生成する
// analyticsExclusionProviders: 差す側の <ドメイン>/plugs/analyticsExclusionProviders/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const provider(並びは<差す側>/<名前> の順、常に読む: gate.plugs を掛けず項目の enabled で閉じる)

import type { AnalyticsExclusionProvider } from "@/domains/core/analytics/services/server/exclusion/types";

export const analyticsExclusionProviders: { domain: string | null; name: string; requires: readonly string[]; plug: AnalyticsExclusionProvider }[] = [];
