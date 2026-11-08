// src/featureGate/rules/interactionTracking.ts
// 利用者の行動の記録(表示・クリックなどの取り込みと管理の集計)。汎用 API /api/interactionEvent は features から導く
// 切り替えの値は今は無い(常に開)。値は土台の後に interactionTracking の config.ts で作る(D29)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/api/interactions",
    "/api/admin/interactions",
  ],
  features: [
    "core/interactionTracking",
  ],
  enabled: () => true,
};
