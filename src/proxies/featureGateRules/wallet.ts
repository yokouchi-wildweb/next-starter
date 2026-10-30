// src/proxies/featureGateRules/wallet.ts
// ウォレット(残高・履歴・ロット。決済は payment.ts)

import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "../types";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/wallet",
    "/api/wallet",
    "/api/walletHistory",
    "/api/me/wallet",
    "/api/admin/wallet",
    "/api/admin/analytics/wallet",
    "/api/admin/analytics/wallet-history",
    "/api/admin/analytics/coin-issuance",
    "/api/cron/wallet-expiration-notice",
    "/api/cron/wallet-expire-lots",
    "/api/cron/wallet-lots-prune",
  ],
  tables: [
    "wallets",
    "wallet_lots",
    "wallet_histories",
  ],
  enabled: () => APP_FEATURES.wallet.enabled,
};
