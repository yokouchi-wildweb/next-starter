// src/config/lib/analyticsConsent.config.ts
// アクセス解析の送信の門の設定の上書き(@lib-config/analyticsConsent)。値はリテラルで書く。キーと既定: src/lib/analyticsConsent/config.ts
// 例: `export default { enabled: true } satisfies AnalyticsConsentOverride;`(同意を待たない運用は consent: "notRequired")
import type { AnalyticsConsentOverride } from "@/lib/analyticsConsent";

export default {} satisfies AnalyticsConsentOverride;
