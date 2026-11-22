// src/domains/wallet/hooks/useWalletBalances.ts

"use client";

import useSWR from "swr";

import type { Wallet } from "@/domains/core/wallet/entities";
import { walletClient } from "@/domains/core/wallet/services/client/walletClient";

type WalletBalanceResult = {
  wallets: Wallet[];
};

export const useWalletBalances = (userId?: string | null) =>
  useSWR<WalletBalanceResult>(
    userId ? `wallet-balances:${userId}` : null,
    async () => {
      if (!userId) {
        return { wallets: [] };
      }
      const search = walletClient.search;

      if (!search) {
        throw new Error("ウォレット情報の検索機能が利用できません");
      }

      const response = await search({
        where: { field: "user_id", op: "eq", value: userId },
      });
      return { wallets: response.results ?? [] };
    },
  );
