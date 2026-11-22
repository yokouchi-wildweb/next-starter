// src/config/domains/analytics.config.ts
// 分析の設定の上書き(持ち主 src/domains/core/analytics/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 例: `export default { issuanceReasonCategories: ["bonus", "other"] } satisfies AnalyticsOverride;`
import type { AnalyticsOverride } from "@/domains/analytics/config";

export default {} satisfies AnalyticsOverride;
