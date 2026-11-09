// src/featureGate/rules/deviceFingerprint.ts
// 端末の指紋(収集・管理の照合・掃除の cron。デモ画面は demoDeviceFingerprint.ts)。汎用 API /api/deviceFingerprint は features から導く
// 処理の切り替えと閉じる値は別: deviceFingerprint の config.ts の collection.enabled は収集の opt-in(既定 false)で、
// この規則は読まない(L1.8)。入切の既定は省略(= 開)、fork が閉じる値は src/config/featureGate/switches.config.ts(D35)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/api/admin/device-fingerprint",
    "/api/me/fingerprint",
  ],
  features: [
    "core/deviceFingerprint",
  ],
};
