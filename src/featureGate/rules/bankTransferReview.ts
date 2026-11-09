// src/featureGate/rules/bankTransferReview.ts
// 銀行振込レビュー(管理画面 + 管理 API)
// 決済方法 bank_transfer_inhouse が選択可能なときだけ露出する(payment 無効なら選択不可)。
// 管理メニューの行(src/features/core/admin/menu/items/bankTransferReviews.ts)はこの規則の住所で隠れる。
// ユーザー側 API(申告 / 進行中取得)は購入開始時点で選択不可メソッドが弾かれるため対象外

import { APP_FEATURES } from "@/config/app/app-features.config";
import { bankTransferInhouseSelectable } from "@/features/purchaseRequest/config";

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/admin/bank-transfer-reviews",
    "/api/admin/bank-transfer-reviews",
  ],
  // 開閉の結果は isPaymentMethodSelectable("bank_transfer_inhouse") と同じ(規則は地区の config の値だけを読む、設定 D100)
  enabled: () => APP_FEATURES.payment.enabled && bankTransferInhouseSelectable,
};
