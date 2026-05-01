// src/features/core/bankTransferReview/utils/validateProofImageUrl.ts
//
// 振込明細画像 URL の検証。submitReview の冒頭で呼ばれる。
//
// セキュリティ意図:
// - UI 側 (useBankTransferProofUpload) は固定パス
//   purchase-requests/bank-transfer-proofs/{requestId} への上書きアップロード方針を採る。
//   この前提を逆手に取って、サーバー側ではパス完全一致まで踏み込んで検証する。
//
// これによりブロックできる攻撃:
// - 任意の外部 URL を proofImageUrl として渡される (Firebase Storage 形式違反 → 弾く)
// - 他ユーザーの振込画像 URL を流用される (パスの requestId 不一致 → 弾く)
// - submit 対象とは別の purchase_request の画像 URL を渡される (同上)

import { DomainError } from "@/lib/errors/domainError";
import { getPathFromStorageUrl } from "@/lib/firebase/server/storage";

import { getBankTransferProofPath } from "../constants/storage";

/**
 * 振込明細画像 URL を検証する。
 *
 * @throws DomainError(400) URL が Firebase Storage 形式でない、または
 *   パスの requestId 部分が submit 対象と一致しない場合
 */
export function validateProofImageUrl(
  url: string,
  purchaseRequestId: string,
): void {
  const path = getPathFromStorageUrl(url);
  if (!path) {
    throw new DomainError(
      "振込明細画像 URL が不正です（Firebase Storage 以外の URL は受け付けません）。",
      { status: 400 },
    );
  }
  const expectedPath = getBankTransferProofPath(purchaseRequestId);
  if (path !== expectedPath) {
    throw new DomainError(
      "振込明細画像 URL が不正です（保存先パスが想定と一致しません）。",
      { status: 400 },
    );
  }
}
