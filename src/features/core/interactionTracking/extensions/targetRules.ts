// 生成物・編集不可: pnpm extensions:generate が src/features/core/interactionTracking/extensionPoints.ts から生成する
// targetRules: src/features/core/interactionTracking/targetRules/<名前>[.<fork の名前>].ts(x) か <名前>[.<fork の名前>]/index.ts(x) の export const rule(並びはファイル名の順)

import type { InteractionTargetRule } from "@/features/core/interactionTracking/types/targetRule";

const targetRulesList: InteractionTargetRule[] = [];
export const targetRules: Readonly<Record<string, InteractionTargetRule>> = Object.fromEntries(targetRulesList.map((item) => [String(item.targetType), item]));
if (Object.keys(targetRules).length !== targetRulesList.length) throw new Error("targetRules: targetType が重複している項目がある");
