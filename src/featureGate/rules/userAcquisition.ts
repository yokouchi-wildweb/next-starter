// src/featureGate/rules/userAcquisition.ts
// 流入経路の記録(タッチの cookie と本登録の帰属)。住所は持たない(route も汎用 API も無い)
// 処理の切り替えと閉じる値は別: src/config/app/acquisition.config.ts の enabled は記録の opt-in(既定 false)で、
// この規則は読まない(L1.8)。閉じる値は土台の後に userAcquisition の config.ts で作る(D29)。今は常に開

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [],
  features: [
    "core/userAcquisition",
  ],
  enabled: () => true,
};
