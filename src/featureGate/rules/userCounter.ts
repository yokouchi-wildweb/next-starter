// src/featureGate/rules/userCounter.ts
// 利用者ごとの回数(サーバの中だけの数え上げ)。汎用 API /api/userCounter は features から導く
// 切り替えの値は今は無い(常に開)。値は土台の後に userCounter の config.ts で作る(D29)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [],
  features: [
    "core/userCounter",
  ],
  enabled: () => true,
};
