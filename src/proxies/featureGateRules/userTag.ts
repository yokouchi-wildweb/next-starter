// src/proxies/featureGateRules/userTag.ts
// ユーザータグ

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "../types";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/admin/user-tags",
    "/api/userTag",
  ],
  enabled: () => APP_FEATURES.user.enableUserTag,
};
