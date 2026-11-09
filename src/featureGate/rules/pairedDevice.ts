// src/featureGate/rules/pairedDevice.ts
// 登録端末(共有端末のペアリングと端末トークン認証)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/api/paired-device",
    "/api/paired-devices",
  ],
  features: [
    "core/pairedDevice",
  ],
  defaultEnabled: false,
};
