// src/domains/core/interactionTracking/services/server/targetRules.ts
//
// 計測対象の規則(点 interactionTrackingTargetRules)を targetType で引く。項目のドメインが閉じていれば外す(gate.plugs)

import { interactionTrackingTargetRules } from "@/domains/core/interactionTracking/extensions/interactionTrackingTargetRules";
import type { InteractionTargetRule } from "@/domains/core/interactionTracking/types/targetRule";
import { gate } from "@/featureGate";

/** targetType の規則。無い・項目のドメインが閉じている = null(呼び手は fail-closed で拒否する) */
export function targetRuleOf(targetType: string): InteractionTargetRule | null {
  return gate.plugs(interactionTrackingTargetRules).find((entry) => entry.plug.targetType === targetType)?.plug ?? null;
}
