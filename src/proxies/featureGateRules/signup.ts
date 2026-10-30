// src/proxies/featureGateRules/signup.ts
// サインアップ(画面と登録系 API。閉じている間は /signup-closed へ)

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "../types";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/signup",
    "/api/auth/register",
    "/api/auth/pre-register",
    "/api/auth/send-email-link",
    "/api/auth/send-early-registration-link",
  ],
  enabled: () => APP_FEATURES.auth.signup.enabled,
  redirectTo: "/signup-closed",
};
