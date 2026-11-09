// src/config/features/purchaseQuota.config.ts
// 購入クォータの設定の上書き(持ち主 src/features/core/purchaseQuota/config.ts だけが読む)。値はリテラルで書く。キーと既定・ルールの書き方: 持ち主の config.ts
import type { PurchaseQuotaOverride } from "@/features/purchaseQuota/config";

export default {} satisfies PurchaseQuotaOverride;
