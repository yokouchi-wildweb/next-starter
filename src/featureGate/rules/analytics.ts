// src/featureGate/rules/analytics.ts
// 管理の集計(DAU・日次の集計・購入やウォレットの集計の API)と利用状況の記録。上流に管理画面は無く API だけ
// 入切の既定は開(defaultEnabled: true)。fork が閉じる値は src/config/featureGate/switches.config.ts(D35)。
// 処理の切り替えと閉じる値は別: analyticsConsent の設定 enabled(src/config/lib/analyticsConsent.config.ts) はブラウザのアクセス解析の送信の値で、この規則は読まない(L1.8)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/api/admin/analytics",
    "/api/activity/dau",
  ],
  domains: [
    "core/analytics",
  ],
  defaultEnabled: false,
};
