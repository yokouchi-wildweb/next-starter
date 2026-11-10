// src/featureGate/rules/userXProfile.ts
// X の連携(X ログイン・連携の解除)。連携の表が無いとログインが成り立たないので住所も一緒に閉じる
// 汎用 API /api/userXProfile は domains から導く。入切の既定は開(defaultEnabled: true)。fork が閉じる値は src/config/featureGate/switches.config.ts(D35)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/api/auth/x",
  ],
  domains: [
    "core/userXProfile",
  ],
  defaultEnabled: true,
};
