// src/proxies/featureGateRules/demoLogin.ts
// デモログイン(画面と、その裏のゲストログイン API)

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "../types";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/demo-login",
    "/api/auth/guest-login",
  ],
  enabled: () => APP_FEATURES.demo.login,
};
