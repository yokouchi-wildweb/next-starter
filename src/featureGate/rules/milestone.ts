// src/featureGate/rules/milestone.ts
// マイルストーン(達成の判定と記録。決済の完了・本登録などの統合ポイントで評価する)。汎用 API /api/milestone は features から導く
// 切り替えの値は今は無い(常に開)。値は土台の後に milestone の config.ts で作る(D29)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [],
  features: [
    "core/milestone",
  ],
  enabled: () => true,
};
