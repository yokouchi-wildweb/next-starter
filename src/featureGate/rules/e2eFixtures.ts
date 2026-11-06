// src/featureGate/rules/e2eFixtures.ts
// 受入のテスト(Playwright、tests/e2e/)が開くページ。既定は閉じる(404。spec は理由を出して skip)。テストを走らせる間だけ開く(tests/e2e/unsavedGuard/README.md)

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: ["/e2e"],
  enabled: () => APP_FEATURES.e2e.fixtures,
};
