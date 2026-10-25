// src/features/core/purchaseRequest/hooks/useBankTransferProofUpload.ts
//
// 自社銀行振込（inhouse プロバイダ）の振込明細画像をアップロードする小フック。
//
// 設計:
// - 用途 purchaseRequest.bankProof（private）に scopeId = requestId で上げ、ref を返す。
//   発行時に「本人の・申告可能な振込依頼か」をサーバーが判定する（isOwnPendingPurchaseRequest）。
// - 申告（/confirm → submitReview）で ref を保存すると、bankTransferReview の storage binding が
//   同じ TX で台帳に紐付ける（本人・同じ requestId・未紐付けの ref だけが通る）。
// - 差し替え・クリアで使わなくなった前の画像は discard で取り消す（申告しなかった画像は掃除でも消える）。

"use client";

import { useCallback, useRef } from "react";

import { storageClient, uploadToStorage, type UploadedFile } from "@/lib/storage/client";

export const BANK_TRANSFER_PROOF_PURPOSE = "purchaseRequest.bankProof";

export type BankTransferProofUpload = {
  /**
   * 画像をアップロードし、申告に渡す ref と表示用 src を返す。
   * 前に上げてまだ申告していない画像は取り消す。
   */
  upload: (file: File | Blob) => Promise<UploadedFile>;
  /** 上げた画像を使わないことにしたとき（クリア）に取り消す */
  discardCurrent: () => void;
};

/**
 * 振込明細画像のアップロードフック。
 *
 * @param requestId purchase_request.id（用途の scopeId）
 */
export function useBankTransferProofUpload(requestId: string): BankTransferProofUpload {
  // 最後に上げた（まだ申告していない）画像
  const currentRef = useRef<string | null>(null);

  const discardCurrent = useCallback(() => {
    const objectId = currentRef.current;
    currentRef.current = null;
    if (!objectId) return;
    storageClient.discard(objectId).catch((error) => {
      // 申告済み（紐付け済み）なら取り消されない。失敗しても掃除で消える
      console.error("[useBankTransferProofUpload] 取り消しに失敗しました", error);
    });
  }, []);

  const upload = useCallback(
    (file: File | Blob) => {
      discardCurrent();
      return new Promise<UploadedFile>((resolve, reject) => {
        uploadToStorage(file, {
          purpose: BANK_TRANSFER_PROOF_PURPOSE,
          // 用途は keep（原本のまま。core.ts）。HEIC も変換せずに送る
          metadata: "keep",
          scopeId: requestId,
          onComplete: (result) => {
            currentRef.current = result.objectId;
            resolve(result);
          },
          onError: reject,
        });
      });
    },
    [requestId, discardCurrent],
  );

  return { upload, discardCurrent };
}
