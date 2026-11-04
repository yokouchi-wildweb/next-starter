// src/featureGate/rules/userTag.ts
// ユーザータグ

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/admin/user-tags",
    "/api/userTag",
  ],
  enabled: () => APP_FEATURES.user.enableUserTag,
};
