// src/features/core/bankTransferReview/hooks/useSubmitBankTransferProof.ts
//
// 自社銀行振込の「振込完了の申告」(POST /api/wallet/purchase/[id]/bank-transfer/confirm)を
// 行う mutation フック。振込案内画面の ConfirmTransferModal が使う。
//
// 成功時は進行中の自社銀行振込(useActiveBankTransfer)のキャッシュを再検証する
// (申告で active 状態 pending_review / pre_submit が変わるため)。遷移(result.redirectUrl)は
// 呼び出し側が行う。useDomainMutation ベースなので失敗は reject で返る(呼び出し側でトースト)。

"use client";

import { useDomainMutation } from "@/lib/crud/hooks";
import {
  submitBankTransferProof,
  type SubmitBankTransferProofParams,
  type SubmitBankTransferProofResponse,
} from "@/features/core/bankTransferReview/services/client/bankTransferReviewClient";

import { ACTIVE_BANK_TRANSFER_KEY } from "./useActiveBankTransfer";

export function useSubmitBankTransferProof() {
  return useDomainMutation<SubmitBankTransferProofResponse, SubmitBankTransferProofParams>(
    "bankTransferReviews/submit-proof",
    (params) => submitBankTransferProof(params),
    ACTIVE_BANK_TRANSFER_KEY,
  );
}
