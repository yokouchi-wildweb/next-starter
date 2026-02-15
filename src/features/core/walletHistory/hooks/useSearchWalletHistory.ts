// src/features/walletHistory/hooks/useSearchWalletHistory.ts

"use client";

import { useSearchDomain } from "@/lib/crud/hooks";
import { walletHistoryClient } from "../services/client/walletHistoryClient";
import type { WalletHistory } from "../entities";
import type { SearchParams } from "@/lib/crud/types";

export type WalletHistorySearchParams = NonNullable<typeof walletHistoryClient.search> extends (
  params: infer P,
) => Promise<unknown>
  ? P
  : SearchParams;

export const useSearchWalletHistory = (params: WalletHistorySearchParams) => {
  const search = walletHistoryClient.search;

  if (!search) {
    throw new Error("WalletHistoryの検索機能が利用できません");
  }

  return useSearchDomain<WalletHistory, WalletHistorySearchParams>(
    "walletHistories/search",
    search,
    params,
  );
};
