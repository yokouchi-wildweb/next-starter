// src/featureGate/rules/adminTabsDemo.ts
// 管理画面のタブのデモ(デモページのフラグに相乗り)

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: ["/admin/tabs-demo"],
  enabled: () => APP_FEATURES.demo.samplePages,
};
