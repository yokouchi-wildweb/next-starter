// src/featureGate/rules/deviceFingerprint.ts
// 端末の指紋(収集・管理の照合・掃除の cron・デモ画面)。汎用 API /api/deviceFingerprint は features から導く
// 処理の切り替えと閉じる値は別: src/config/app/fingerprint.config.ts の collection.enabled は収集の opt-in(既定 false)で、
// この規則は読まない(L1.8)。閉じる値は土台の後に deviceFingerprint の config.ts で作る(D29)。今は常に開

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/api/admin/device-fingerprint",
    "/api/me/fingerprint",
    "/api/cron/device-fingerprint-prune",
    "/demo/fingerprint",
  ],
  features: [
    "core/deviceFingerprint",
  ],
  enabled: () => true,
};
