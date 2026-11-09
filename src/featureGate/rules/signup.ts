// src/featureGate/rules/signup.ts
// サインアップ(画面と登録系 API。閉じている間は /signup-closed へ)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/signup",
    "/api/auth/register",
    "/api/auth/pre-register",
    "/api/auth/send-email-link",
    "/api/auth/send-early-registration-link",
  ],
  defaultEnabled: true,
  redirectTo: "/signup-closed",
};
