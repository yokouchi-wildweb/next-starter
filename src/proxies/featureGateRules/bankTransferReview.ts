// src/proxies/featureGateRules/bankTransferReview.ts
// 銀行振込レビュー(管理画面 + 管理 API)
// 決済方法 bank_transfer_inhouse が選択可能なときだけ露出する(payment 無効なら選択不可)。
// 管理メニュー(admin-global-menu.config.ts)と同じ判定で連動。
// ユーザー側 API(申告 / 進行中取得)は購入開始時点で選択不可メソッドが弾かれるため対象外

import { isPaymentMethodSelectable } from "@/config/app/payment.config";

import type { FeatureGateRule } from "../types";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/admin/bank-transfer-reviews",
    "/api/admin/bank-transfer-reviews",
  ],
  enabled: () => isPaymentMethodSelectable("bank_transfer_inhouse"),
};
