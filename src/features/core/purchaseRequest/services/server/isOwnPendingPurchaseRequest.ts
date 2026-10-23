// src/features/core/purchaseRequest/services/server/isOwnPendingPurchaseRequest.ts
//
// 振込明細（ファイル用途 purchaseRequest.bankProof）をアップロードしてよい購入リクエストかを判定する。
// 条件は振込の申告（bankTransferReview の submitReview）が受け付ける条件と同じ:
// - 本人の購入リクエスト
// - 自社銀行振込（inhouse provider + bank_transfer method）
// - status が processing（通常の申告）か completed（即時モードで付与済み、判定前の差し替え）
// - レビューがまだ判定済み（confirmed / rejected）でない
// 「pending」はリクエストの status ではなく、申告の判定がまだ済んでいないことを指す。

import { findByPurchaseRequest } from "@/features/core/bankTransferReview/services/server/wrappers/findHelpers";
import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities/model";

import { base as purchaseRequestBase } from "./drizzleBase";
import { INHOUSE_BANK_TRANSFER_METHOD_ID, INHOUSE_PROVIDER_NAME } from "./payment/inhouse";

const SUBMITTABLE_STATUSES: readonly PurchaseRequest["status"][] = ["processing", "completed"];

export async function isOwnPendingPurchaseRequest(
  purchaseRequestId: string | null,
  actor: { userId: string } | null,
): Promise<boolean> {
  if (!purchaseRequestId || !actor) return false;
  const request = (await purchaseRequestBase.get(purchaseRequestId)) as PurchaseRequest | null;
  if (!request || request.user_id !== actor.userId) return false;
  if (
    request.payment_provider !== INHOUSE_PROVIDER_NAME ||
    request.payment_method !== INHOUSE_BANK_TRANSFER_METHOD_ID
  ) {
    return false;
  }
  if (!SUBMITTABLE_STATUSES.includes(request.status)) return false;
  const review = await findByPurchaseRequest(purchaseRequestId);
  return !(review && (review.status === "confirmed" || review.status === "rejected"));
}
