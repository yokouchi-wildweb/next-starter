// src/featureGate/rules/e2eFixtures.ts
// 受入のテスト(Playwright、e2e/)が開くページ。既定は閉じる(404)。テストを走らせる間だけ開く(e2e/README.md)

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: ["/e2e"],
  enabled: () => APP_FEATURES.e2e.fixtures,
};
