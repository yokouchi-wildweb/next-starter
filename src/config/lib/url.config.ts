// src/config/lib/url.config.ts
// アプリのベース URL の設定の上書き(@lib-config/url)。値はリテラルか @/business の値。キーと既定: src/lib/url/config.ts
// 上流は事業の素性の url を写す(本番の URL は src/business/business.ts で変える。dev / preview は env APP_BASE_URL・VERCEL_URL)
import { business } from "@/business";
import type { UrlOverride } from "@/lib/url";

export default { baseUrl: business.url } satisfies UrlOverride;
