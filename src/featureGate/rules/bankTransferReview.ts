// src/featureGate/rules/bankTransferReview.ts
// 銀行振込レビュー(管理画面 + 管理 API)
// 決済(payment)に dependsOn。決済方法 bank_transfer_inhouse が選択可能なときだけ露出する(選べるかの判定は決済の値も読むので二重だが害は無い)。
// 管理メニューの行(src/features/core/admin/menu/items/bankTransferReviews.ts)はこの規則の住所で隠れる。
// ユーザー側 API(申告 / 進行中取得)は購入開始時点で選択不可メソッドが弾かれるため対象外

import { bankTransferInhouseSelectable } from "@/features/purchaseRequest/config";

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  dependsOn: ["payment"],
  pathPatterns: [
    "/admin/bank-transfer-reviews",
    "/api/admin/bank-transfer-reviews",
  ],
  // 入切でない条件: 銀行振込の方法が選べるか(決済そのものの入切は dependsOn payment。規則は地区の config の値だけを読む、設定 D100)
  enabled: () => bankTransferInhouseSelectable,
  defaultEnabled: true,
};
