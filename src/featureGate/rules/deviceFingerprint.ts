// src/featureGate/rules/deviceFingerprint.ts
// 端末の指紋(収集・管理の照合・掃除の cron。デモ画面は demoDeviceFingerprint.ts)。汎用 API /api/deviceFingerprint は domains から導く
// 入切がこの機能(収集)の opt-in で、既定は閉(D114・D120)。処理の値(保持期間など)は持ち主の config.ts。
// fork が開ける値は src/config/featureGate/switches.config.ts(D35)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  defaultEnabled: false,
  pathPatterns: [
    "/api/admin/device-fingerprint",
    "/api/me/fingerprint",
  ],
  domains: [
    "core/deviceFingerprint",
  ],
};
