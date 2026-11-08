// src/features/core/bankTransferReview/hooks/useAdminBankTransferReviewList.ts
//
// 管理画面の振込レビュー一覧(1 ページ分)。ページ・選択中の行の状態もここで持つ:
// - status か検索語が変わったら 1 ページ目に戻し、選択を空にする
// - ページを移ったら選択を空にする(ページを跨いだ選択は持たない。一括操作の対象は表示中のページ内)
// refresh は一覧と status 別件数(useAdminBankTransferReviewStatusCounts)を取り直す(承認・CSV 取り込みの後など)。
// searchQuery を省くと URL の ?searchQuery=(管理画面の SearchBox が書く)を読む。1 ページの件数 limit は画面の値(API の上限 100)。

"use client";

import { useCallback, useState, type Key } from "react";
import { useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";

import { adminListBankTransferReviews, type BankTransferReviewStatus } from "@/features/core/bankTransferReview";

import { adminBankTransferReviewListKey, refreshAdminBankTransferReviewCaches } from "./adminBankTransferReviewKeys";

export type UseAdminBankTransferReviewListOptions = {
  status: BankTransferReviewStatus;
  /** 検索語。省略 = URL の searchQuery */
  searchQuery?: string;
  /** 1 ページの件数。省略 = 20(API の既定)。最大 100 */
  limit?: number;
};

const DEFAULT_LIMIT = 20;

export function useAdminBankTransferReviewList({ status, searchQuery: searchQueryOption, limit = DEFAULT_LIMIT }: UseAdminBankTransferReviewListOptions) {
  const params = useSearchParams();
  const searchQuery = searchQueryOption ?? params.get("searchQuery") ?? "";
  const { mutate: globalMutate } = useSWRConfig();

  const [page, setPage] = useState(1);
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);

  // 範囲(status・検索語・ページ)が変わったら選択を空にする。effect 内の setState を避け、
  // レンダー中に前回の範囲と比べる(React の推奨の形)
  const [prevScope, setPrevScope] = useState({ status, searchQuery, page });
  if (prevScope.status !== status || prevScope.searchQuery !== searchQuery) {
    setPrevScope({ status, searchQuery, page: 1 });
    setPage(1);
    setSelectedKeys([]);
  } else if (prevScope.page !== page) {
    setPrevScope({ status, searchQuery, page });
    setSelectedKeys([]);
  }

  const { data, isLoading, error, mutate } = useSWR(
    adminBankTransferReviewListKey({ status, searchQuery, page, limit }),
    () => adminListBankTransferReviews({ status, searchQuery: searchQuery || undefined, page, limit }),
  );

  const refresh = useCallback(async () => {
    await Promise.all([mutate(), refreshAdminBankTransferReviewCaches(globalMutate, ["statusCounts"])]);
  }, [mutate, globalMutate]);

  const total = data?.total ?? 0;
  return {
    data,
    items: data?.items ?? [],
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    page,
    setPage,
    selectedKeys,
    setSelectedKeys,
    searchQuery,
    isLoading,
    error,
    refresh,
  };
}
