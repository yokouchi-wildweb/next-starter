// src/featureGate/rules/userXProfile.ts
// X の連携(X ログイン・連携の解除)。連携の表が無いとログインが成り立たないので住所も一緒に閉じる
// 汎用 API /api/userXProfile は features から導く。切り替えの値は今は無い(常に開)。値は土台の後に userXProfile の config.ts で作る(D29)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/api/auth/x",
  ],
  features: [
    "core/userXProfile",
  ],
  enabled: () => true,
};
