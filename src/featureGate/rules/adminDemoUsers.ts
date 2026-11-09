// src/featureGate/rules/adminDemoUsers.ts
// デモユーザーの管理(layout の判定と同じフラグ。画面に来る前に proxy で止める)。デモのログイン(demoLogin)が無ければ要らないので dependsOn(D28)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  dependsOn: ["demoLogin"],
  pathPatterns: ["/admin/users/demo"],
  defaultEnabled: true,
};
