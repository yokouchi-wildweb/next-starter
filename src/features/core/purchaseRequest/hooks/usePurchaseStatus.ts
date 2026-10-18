// src/features/core/purchaseRequest/hooks/usePurchaseStatus.ts
//
// 購入リクエストのステータス(/api/wallet/purchase/[id]/status)を 1 回取得する SWR フック。
// 完了画面(PurchaseComplete)と確認待ち画面(PurchaseAwaitingReview)が使う。
// ポーリングして遷移するのは usePurchaseStatusPolling(callback 画面)の役割で、こちらは取得だけ。
//
// requestId が null(URL に request_id が無い)なら取得しない(key = null)。呼び出し側が
// 「リクエスト ID が指定されていません」を描く。
// オーナーシップは API 側が session で強制する(他人の requestId は 404 → error)。

"use client";

import useSWR from "swr";

import {
  getPurchaseStatus,
  type PurchaseStatusResponse,
} from "@/features/core/purchaseRequest/services/client/purchaseRequestClient";

/** SWR のキャッシュキー(API パスをそのまま使い衝突を避ける) */
export const purchaseStatusKey = (requestId: string) => `/api/wallet/purchase/${requestId}/status`;

export function usePurchaseStatus(requestId: string | null) {
  return useSWR<PurchaseStatusResponse>(
    requestId ? purchaseStatusKey(requestId) : null,
    () => getPurchaseStatus(requestId as string),
    // 完了後のステータスは変わらないため、フォーカス復帰での再取得はしない。
    // 失敗(他人の requestId の 404 等)も 1 回で確定させる(SWR 既定のリトライは isLoading を
    // 立て直すため、呼び出し側のスピナーとエラー表示が交互に出続ける)
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
}
