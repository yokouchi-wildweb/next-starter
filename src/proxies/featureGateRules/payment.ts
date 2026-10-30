// src/proxies/featureGateRules/payment.ts
// 決済(購入・決済プロバイダ webhook・銀行振込・購入上限)
// /admin/bank-transfer-reviews は bankTransferReview.ts でも閉じるが、決済のテーブルを使うのでここでも閉じる

import { APP_FEATURES } from "@/config/app/app-features.config";
import { CURRENCY_CONFIG } from "@/config/app/currency.config";

import type { FeatureGateRule } from "../types";

const walletSlugs = Object.values(CURRENCY_CONFIG).map((currency) => currency.slug);

export const rule: FeatureGateRule = {
  pathPatterns: [
    ...walletSlugs.map((slug) => `/wallet/${slug}/purchase`),
    "/api/wallet/purchase",
    "/api/purchaseRequest",
    "/api/webhook/payment",
    "/api/admin/analytics/purchase",
    "/api/cron/expire-pending-purchases",
    "/admin/bank-transfer-reviews",
    "/api/admin/bank-transfer-reviews",
    "/demo/dummy-payment",
  ],
  tables: [
    "purchase_requests",
    "bank_transfer_reviews",
    "purchase_quota_ledger",
  ],
  enabled: () => APP_FEATURES.payment.enabled,
};
