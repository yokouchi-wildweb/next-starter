// src/featureGate/rules/demoPages.ts
// デモページ(裏側の API ルートも併せて無効化する)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/demo",
    "/api/demo",
  ],
  defaultEnabled: false,
};
