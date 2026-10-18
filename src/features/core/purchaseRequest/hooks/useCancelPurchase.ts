// src/features/core/purchaseRequest/hooks/useCancelPurchase.ts
//
// 自分の進行中の購入リクエストをキャンセルする mutation フック
// (POST /api/wallet/purchase/[id]/cancel)。銀行振込の案内画面の CancelTransferButton が使う。
//
// 成功時は進行中の自社銀行振込(useActiveBankTransfer)のキャッシュを再検証する
// (active 状態が消えるため)。遷移(result.redirectUrl)は呼び出し側が行う。
// useDomainMutation ベースなので同一インスタンスでの並列 trigger も個別の結果で解決する。

"use client";

import { useDomainMutation } from "@/lib/crud/hooks";
import { ACTIVE_BANK_TRANSFER_KEY } from "@/features/core/bankTransferReview/hooks/useActiveBankTransfer";
import {
  cancelPurchase,
  type CancelPurchaseResponse,
} from "@/features/core/purchaseRequest/services/client/purchaseRequestClient";

export function useCancelPurchase() {
  return useDomainMutation<CancelPurchaseResponse, string>(
    "purchaseRequests/cancel",
    (requestId) => cancelPurchase(requestId),
    ACTIVE_BANK_TRANSFER_KEY,
  );
}
