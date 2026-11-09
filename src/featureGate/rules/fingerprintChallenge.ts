// src/featureGate/rules/fingerprintChallenge.ts
// 指紋の確認(チャレンジの発行・提出・管理・掃除の cron)。deviceFingerprint を前提にする(requires なので dependsOn も、D24)。汎用 API /api/fingerprintChallenge は domains から導く
// 入切がこの機能(確認)の opt-in で、既定は閉(D114・D120)。処理の値(保持期間など)は持ち主の config.ts。
// fork が開ける値は src/config/featureGate/switches.config.ts(D35)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  dependsOn: ["deviceFingerprint"],
  defaultEnabled: false,
  pathPatterns: [
    "/api/admin/fingerprint-challenges",
    "/api/me/fingerprint-challenges",
  ],
  domains: [
    "core/fingerprintChallenge",
  ],
};
