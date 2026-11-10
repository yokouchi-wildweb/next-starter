// src/featureGate/rules/messagingTracking.ts
// 連絡の開封・クリックの計測(D36・D57)。閉の間、provider の webhook の opened / clicked は記録も反映もしない。
// 住所もドメインも持たない(受け口 /api/webhook/messaging は配達・bounce・苦情のために常に開)。
// 入切の既定は閉(defaultEnabled: false)。fork が開ける値は src/config/featureGate/switches.config.ts(D35)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [],
  domains: [],
  defaultEnabled: false,
};
