// src/featureGate/rules/userCounter.ts
// 利用者ごとの回数(サーバの中だけの数え上げ)。汎用 API /api/userCounter は domains から導く
// 入切の既定は省略(= 開)。fork が閉じる値は src/config/featureGate/switches.config.ts(D35)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [],
  domains: [
    "core/userCounter",
  ],
};
