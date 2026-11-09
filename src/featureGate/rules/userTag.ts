// src/featureGate/rules/userTag.ts
// ユーザータグ

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/admin/user-tags",
    "/api/userTag",
  ],
  defaultEnabled: true,
};
