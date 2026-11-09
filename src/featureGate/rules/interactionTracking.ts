// src/featureGate/rules/interactionTracking.ts
// 利用者の行動の記録(表示・クリックなどの取り込みと管理の集計)。汎用 API /api/interactionEvent は features から導く
// 入切の既定は省略(= 開)。fork が閉じる値は src/config/featureGate/switches.config.ts(D35)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/api/interactions",
    "/api/admin/interactions",
  ],
  features: [
    "core/interactionTracking",
  ],
};
