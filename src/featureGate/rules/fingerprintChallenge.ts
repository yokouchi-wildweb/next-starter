// src/featureGate/rules/fingerprintChallenge.ts
// 指紋の確認(チャレンジの発行・提出・管理・掃除の cron)。deviceFingerprint を前提にする(requires なので dependsOn も、D24)。汎用 API /api/fingerprintChallenge は domains から導く
// 処理の切り替えと閉じる値は別: fingerprintChallenge の config.ts の challenge.enabled は確認の opt-in(既定 false)で、
// この規則は読まない(L1.8)。入切の既定は省略(= 開)、fork が閉じる値は src/config/featureGate/switches.config.ts(D35)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  dependsOn: ["deviceFingerprint"],
  pathPatterns: [
    "/api/admin/fingerprint-challenges",
    "/api/me/fingerprint-challenges",
  ],
  domains: [
    "core/fingerprintChallenge",
  ],
};
