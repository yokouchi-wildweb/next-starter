// src/app/admin/(protected)/bank-transfer-reviews/[status]/_screen/useStatusCounts.ts
//
// status 別件数の取得はドメインの公開 hook へ移した(@/features/core/bankTransferReview/hooks/useAdminBankTransferReviewStatusCounts)。
// ここは今までの import 先を壊さないための名前だけの包み(URL の searchQuery で絞る)。新しく書く物は公開 hook を呼ぶ。

"use client";

import { useAdminBankTransferReviewStatusCounts } from "@/features/core/bankTransferReview/hooks/useAdminBankTransferReviewStatusCounts";

export function useStatusCounts() {
  return useAdminBankTransferReviewStatusCounts();
}
