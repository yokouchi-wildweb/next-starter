// src/features/wallet/hooks/useSearchWallet.ts

"use client";

import { useSearchDomain } from "@/lib/crud/hooks";
import { walletClient } from "../services/client/walletClient";
import type { Wallet } from "../entities";
import type { SearchParams } from "@/lib/crud/types";

export type WalletSearchParams = typeof walletClient.search extends (
  params: infer P,
) => Promise<unknown>
  ? P
  : SearchParams;

export const useSearchWallet = (params: WalletSearchParams) => {
  const search = walletClient.search;

  if (!search) {
    throw new Error("Walletの検索機能が利用できません");
  }

  return useSearchDomain<Wallet, WalletSearchParams>(
    "wallets/search",
    search,
    params,
  );
};
