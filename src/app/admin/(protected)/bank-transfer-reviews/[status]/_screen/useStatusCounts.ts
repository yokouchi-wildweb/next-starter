// src/app/admin/(protected)/bank-transfer-reviews/[status]/_screen/useStatusCounts.ts
//
// status 別件数(タブのラベルの "(N)")。ヘッダーの行の中央のタブ(BankTransferStatusTabs)と一覧の本体
// (BankTransferReviewListPanel)が同じ SWR のキーで読むので、取得は 1 回、一覧の操作の後の mutate でタブも更新される。
// ページ移動では再取得せず、検索クエリ(URL の searchQuery)が変わったときと一覧の操作の後にだけ取り直す。

"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";

import { adminGetBankTransferReviewStatusCounts } from "@/features/core/bankTransferReview";

export function useStatusCounts() {
  const params = useSearchParams();
  const searchQuery = params.get("searchQuery") ?? "";
  const key = useMemo(() => ["adminGetBankTransferReviewStatusCounts", searchQuery] as const, [searchQuery]);
  return useSWR(key, async () =>
    adminGetBankTransferReviewStatusCounts({
      searchQuery: searchQuery || undefined,
    }),
  );
}
