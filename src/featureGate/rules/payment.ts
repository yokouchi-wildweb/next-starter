// src/featureGate/rules/payment.ts
// 決済(購入・決済プロバイダ webhook・銀行振込・購入上限)
// ウォレット(wallet)に dependsOn(購入は残高に積む。purchaseRequest の requires と外部キー)。
// 銀行振込レビューの画面 /admin/bank-transfer-reviews は bankTransferReview.ts だけが持つ(payment に dependsOn)

import { APP_FEATURES } from "@/config/app/app-features.config";
import { walletConfig } from "@/features/wallet/config";

import type { FeatureGateRule } from "@/featureGate";

const walletSlugs = Object.values(walletConfig.currency).map((currency) => currency.slug);

export const rule: FeatureGateRule = {
  dependsOn: ["wallet"],
  pathPatterns: [
    ...walletSlugs.map((slug) => `/wallet/${slug}/purchase`),
    "/api/wallet/purchase",
    "/api/webhook/payment",
    "/api/admin/analytics/purchase",
    "/demo/dummy-payment",
  ],
  features: [
    "core/purchaseRequest",
    "core/bankTransferReview",
    "core/purchaseQuota",
  ],
  enabled: () => APP_FEATURES.payment.enabled,
};
