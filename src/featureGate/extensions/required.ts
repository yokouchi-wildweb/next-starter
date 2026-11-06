// 生成物・編集不可: pnpm generate extensions が src/featureGate/extensionPoints.ts から生成する
// required: src/featureGate/required/<名前>.ts(x) か <名前>/index.ts(x) の export const required(並びはファイル名の順)

import type { RequiredFeature } from "@/featureGate";

export const required: RequiredFeature[] = [];
