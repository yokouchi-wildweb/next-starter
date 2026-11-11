// src/featureGate/rules/userAcquisition.ts
// 流入経路の記録(タッチの cookie と本登録の帰属)。住所は持たない(route も汎用 API も無い)
// 記録するかはこの規則の入切だけ(記録の opt-in enabled は一本化した、設定 L1.56)。処理の値(cookie の期間・判別表)は
// src/features/core/userAcquisition/config.ts。入切の上流の既定は閉(設定 D115)、fork の値は src/config/featureGate/switches.config.ts(D35)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [],
  domains: [
    "core/userAcquisition",
  ],
  defaultEnabled: false,
};
