// src/proxies/featureGateRules/demoPages.ts
// デモページ(裏側の API ルートも併せて無効化する)

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "../types";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/demo",
    "/api/demo",
  ],
  enabled: () => APP_FEATURES.demo.samplePages,
};
