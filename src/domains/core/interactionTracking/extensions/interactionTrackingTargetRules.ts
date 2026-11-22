// 生成物・編集不可: pnpm generate extensions が src/domains/core/interactionTracking/extensionPoints.ts から生成する
// interactionTrackingTargetRules: 差す側の <ドメイン>/plugs/interactionTrackingTargetRules/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const rule(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { InteractionTargetRule } from "@/domains/core/interactionTracking/types/targetRule";

export const interactionTrackingTargetRules: { domain: string | null; name: string; requires: readonly string[]; plug: InteractionTargetRule }[] = [];
