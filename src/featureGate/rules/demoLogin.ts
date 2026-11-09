// src/featureGate/rules/demoLogin.ts
// デモログイン(画面と、その裏のゲストログイン API)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/demo-login",
    "/api/auth/guest-login",
  ],
  defaultEnabled: true,
};
