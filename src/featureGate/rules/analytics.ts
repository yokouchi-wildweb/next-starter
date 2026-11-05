// src/featureGate/rules/analytics.ts
// 管理の集計(DAU・日次の集計・購入やウォレットの集計の API)と利用状況の記録。上流に管理画面は無く API だけ
// 切り替えの値は今は無い(常に開)。値は土台の後に analytics の config.ts で作る(D29)。
// 処理の切り替えと閉じる値は別: src/config/app/analytics.config.ts の enabled はブラウザのアクセス解析の送信の値で、この規則は読まない(L1.8)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/api/admin/analytics",
    "/api/activity/dau",
    "/api/cron/analytics-rollup-daily",
  ],
  features: [
    "core/analytics",
  ],
  enabled: () => true,
};
