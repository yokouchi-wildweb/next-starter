// src/features/core/bankTransferReview/hooks/useAdminBankTransferReviewStatusCounts.ts
//
// 管理画面の status 別件数(タブのラベルの "(N)")。タブと一覧が同じキーで読むので取得は 1 回、
// 一覧の操作の後の取り直し(useAdminBankTransferReviewList の refresh)でタブも更新される。
// ページ移動では取り直さず、検索語が変わったときと一覧の操作の後にだけ取り直す。
// searchQuery を省くと URL の ?searchQuery=(管理画面の SearchBox が書く)を読む。

"use client";

import { useSearchParams } from "next/navigation";
import useSWR from "swr";

import { adminGetBankTransferReviewStatusCounts } from "@/features/core/bankTransferReview";

import { adminBankTransferReviewStatusCountsKey } from "./adminBankTransferReviewKeys";

export type UseAdminBankTransferReviewStatusCountsOptions = {
  /** 件数を絞る検索語。省略 = URL の searchQuery */
  searchQuery?: string;
};

export function useAdminBankTransferReviewStatusCounts(options: UseAdminBankTransferReviewStatusCountsOptions = {}) {
  const params = useSearchParams();
  const searchQuery = options.searchQuery ?? params.get("searchQuery") ?? "";
  return useSWR(adminBankTransferReviewStatusCountsKey(searchQuery), () =>
    adminGetBankTransferReviewStatusCounts({ searchQuery: searchQuery || undefined }),
  );
}
