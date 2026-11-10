// src/featureGate/rules/demoLogin.ts
// デモログイン(画面と、その裏のデモのログインの API。処理は core/demo)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/demo-login",
    "/api/demo-login",
  ],
  defaultEnabled: true,
};
