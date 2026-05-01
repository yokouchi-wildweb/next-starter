// src/features/core/purchaseRequest/hooks/useBankTransferProofUpload.ts
//
// 自社銀行振込（inhouse プロバイダ）の振込明細画像を Firebase Storage に
// アップロードする小フック。
//
// 設計:
// - 同一 purchase_request に対して固定パスへ上書きアップロードする。
//   Firebase Storage の uploadBytes は同パス指定で上書き挙動になるため、
//   再アップロード時も Storage 上のファイルは常に最新の 1 件のみ残る。
// - 申告せず離脱したユーザーの孤児ファイルも requestId 単位で 1 件以下に
//   抑制できる（後続でバックエンド担当者が cron による定期削除を実装する想定）。
// - ランダム UUID を付与する useAppStorage / useDirectStorage では同パス上書きが
//   できないため、こちらは directStorageClient を直接呼ぶ。
//
// パスは `purchase-requests/bank-transfer-proofs/{requestId}` 固定（拡張子なし）。
// 拡張子を付けると jpg/png/heic 等の差し替え時にパスが変わって上書きされなくなるため、
// 明細画像は拡張子レスで保管する（content-type は Firebase Storage が保持）。

"use client";

import { useCallback } from "react";

import { directStorageClient } from "@/lib/storage/client/directStorageClient";

const PROOF_BASE_PATH = "purchase-requests/bank-transfer-proofs";

export type BankTransferProofUpload = {
  /**
   * 画像を固定パスへアップロードし、ダウンロード URL を返す。
   * 同一 requestId で複数回呼ぶと Storage 上のファイルは上書きされる。
   */
  upload: (file: File | Blob) => Promise<string>;
};

/**
 * 振込明細画像のアップロードフック。
 *
 * @param requestId purchase_request.id（パスの一部）
 */
export function useBankTransferProofUpload(requestId: string): BankTransferProofUpload {
  const upload = useCallback(
    async (file: File | Blob): Promise<string> => {
      const path = `${PROOF_BASE_PATH}/${requestId}`;
      return directStorageClient.upload(path, file);
    },
    [requestId],
  );

  return { upload };
}
