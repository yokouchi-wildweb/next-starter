// src/features/core/bankTransferReview/constants/storage.ts
//
// 自社銀行振込の振込明細画像の Firebase Storage 配置規約。
//
// UI 側 (useBankTransferProofUpload) とサーバー側検証 (validateProofImageUrl) の
// 両方で参照できるよう、固定パス prefix をここに集約する。
// 拡張子なしの purchase-requests/bank-transfer-proofs/{requestId} で上書き運用。

/**
 * 振込明細画像の Storage パス prefix（末尾スラッシュ込み）。
 * 完全パスは `${prefix}{requestId}` で組み立てる。
 */
export const BANK_TRANSFER_PROOF_PATH_PREFIX =
  "purchase-requests/bank-transfer-proofs/" as const;

/**
 * 指定 requestId に対する Storage 完全パスを返す。
 * UI 側のアップロードもサーバー側の検証も同じ式から派生させる。
 */
export function getBankTransferProofPath(requestId: string): string {
  return `${BANK_TRANSFER_PROOF_PATH_PREFIX}${requestId}`;
}
