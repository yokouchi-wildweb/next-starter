// src/features/core/bankTransferReview/hooks/useAdminBankTransferReview.ts
//
// 管理画面の振込レビュー 1 件の詳細(詳細モーダル)。reviewId が null の間は取得しない。
// reviewId が変わるたびに 1 回取得し、取り直しは refresh(承認・メモの保存の後など)。
// walletEnabled = ウォレットの機能が開いているか(閉じているときは通貨の部品・設定を使わず付与額を数字だけで出す)。
// 門番の読み取りを表示の部品に置かないよう、ここで返す。

"use client";

import useSWR from "swr";

import { useGate } from "@/featureGate/client";
import { adminGetBankTransferReview } from "@/features/core/bankTransferReview";

import { adminBankTransferReviewDetailKey } from "./adminBankTransferReviewKeys";

export function useAdminBankTransferReview(reviewId: string | null) {
  const walletEnabled = useGate().enabled("wallet");
  const { data, isLoading, error, mutate } = useSWR(
    reviewId ? adminBankTransferReviewDetailKey(reviewId) : null,
    ([, id]) => adminGetBankTransferReview(id),
  );
  return {
    data,
    review: data?.review,
    isLoading,
    error,
    refresh: () => mutate(),
    walletEnabled,
  };
}
