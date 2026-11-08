// src/featureGate/rules/wallet.ts
// ウォレット(残高・履歴・ロット。決済は payment.ts)

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/wallet",
    "/api/me/wallet",
    "/api/admin/wallet",
    "/api/admin/analytics/wallet",
    "/api/admin/analytics/wallet-history",
    "/api/admin/analytics/coin-issuance",
  ],
  features: [
    "core/wallet",
    "core/walletHistory",
  ],
  enabled: () => APP_FEATURES.wallet.enabled,
};
