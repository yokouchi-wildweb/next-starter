// src/featureGate/rules/milestone.ts
// マイルストーン(達成の判定と記録。決済の完了・本登録などの統合ポイントで評価する)。汎用 API /api/milestone は domains から導く
// 入切の既定は開(defaultEnabled: true)。fork が閉じる値は src/config/featureGate/switches.config.ts(D35)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [],
  domains: [
    "core/milestone",
  ],
  defaultEnabled: true,
};
