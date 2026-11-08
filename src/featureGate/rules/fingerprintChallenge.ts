// src/featureGate/rules/fingerprintChallenge.ts
// 指紋の確認(チャレンジの発行・提出・管理・掃除の cron)。deviceFingerprint を前提にする(requires)。汎用 API /api/fingerprintChallenge は features から導く
// 処理の切り替えと閉じる値は別: src/config/app/fingerprint.config.ts の challenge の enabled は確認の opt-in(既定 false)で、
// この規則は読まない(L1.8)。閉じる値は土台の後に fingerprintChallenge の config.ts で作る(D29)。今は常に開

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/api/admin/fingerprint-challenges",
    "/api/me/fingerprint-challenges",
  ],
  features: [
    "core/fingerprintChallenge",
  ],
  enabled: () => true,
};
