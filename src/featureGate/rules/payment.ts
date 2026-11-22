// src/featureGate/rules/payment.ts
// 決済(購入・決済プロバイダ webhook・銀行振込・購入上限)
// ウォレット(wallet)に dependsOn(購入は残高に積む。purchaseRequest の requires と外部キー)。
// 購入の集計の API は paymentAnalytics.ts、ダミー決済のデモ画面は demoPayment.ts。銀行振込レビューの画面 /admin/bank-transfer-reviews は bankTransferReview.ts だけが持つ(payment に dependsOn)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  dependsOn: ["wallet"],
  pathPatterns: [
    // 通貨ごとの購入画面(/wallet/<通貨の slug>/purchase)。規則はドメインの値を読まず、slug は * で受ける(D23)
    "/wallet/*/purchase",
    "/api/wallet/purchase",
    "/api/webhook/payment",
  ],
  domains: [
    "core/purchaseRequest",
    "core/bankTransferReview",
    "core/purchaseQuota",
  ],
  defaultEnabled: false,
};
