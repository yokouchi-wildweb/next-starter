// src/proxies/featureGateRules/adminDemoUsers.ts
// デモユーザーの管理(layout の判定と同じフラグ。画面に来る前に proxy で止める)

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "../types";

export const rule: FeatureGateRule = {
  pathPatterns: ["/admin/users/demo"],
  enabled: () => APP_FEATURES.adminConsole.enableDemoUser,
};
