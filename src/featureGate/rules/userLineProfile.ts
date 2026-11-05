// src/featureGate/rules/userLineProfile.ts
// LINE の連携(LINE ログイン・連携の解除・LINE の webhook)。連携の表が無いとログインが成り立たないので住所も一緒に閉じる
// 汎用 API /api/userLineProfile は features から導く。切り替えの値は今は無い(常に開)。値は土台の後に userLineProfile の config.ts で作る(D29)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/api/auth/line",
    "/api/webhook/line",
  ],
  features: [
    "core/userLineProfile",
  ],
  enabled: () => true,
};
