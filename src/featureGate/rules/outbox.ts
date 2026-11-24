// src/featureGate/rules/outbox.ts
// 送り箱(src/domains/core/outbox): 住所を持たない(表と定期処理だけ)。どの区切りでも既定は閉(D22・D53)で、閉じている間は表を作らず
// 定期処理も閉じる。送り箱を使う口の機能の規則はこの規則を dependsOn する(か同じドメインを挙げる)。fork が開く値は src/config/featureGate/switches.config.ts

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [],
  domains: [
    "core/outbox",
  ],
  defaultEnabled: false,
};
