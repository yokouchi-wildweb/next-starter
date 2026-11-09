// src/featureGate/rules/userAcquisition.ts
// 流入経路の記録(タッチの cookie と本登録の帰属)。住所は持たない(route も汎用 API も無い)
// 処理の切り替えと閉じる値は別: src/config/app/acquisition.config.ts の enabled は記録の opt-in(既定 false)で、
// この規則は読まない(L1.8)。入切の既定は省略(= 開)、fork が閉じる値は src/config/featureGate/switches.config.ts(D35)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [],
  features: [
    "core/userAcquisition",
  ],
};
