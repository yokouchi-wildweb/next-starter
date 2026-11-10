// src/featureGate/rules/userLineProfile.ts
// LINE の連携(LINE ログイン・連携の解除・LINE の webhook)。連携の表が無いとログインが成り立たないので住所も一緒に閉じる
// 汎用 API /api/userLineProfile は domains から導く。入切の既定は開(defaultEnabled: true)。fork が閉じる値は src/config/featureGate/switches.config.ts(D35)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/api/auth/line",
    "/api/webhook/line",
  ],
  domains: [
    "core/userLineProfile",
  ],
  defaultEnabled: true,
};
