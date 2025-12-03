// src/features/walletHistory/hooks/useUpsertWalletHistory.ts

"use client";

import { useUpsertDomain } from "@/lib/crud/hooks";
import { walletHistoryClient } from "../services/client/walletHistoryClient";
import type { WalletHistory } from "../entities";
import type { WalletHistoryCreateFields } from "../entities/form";

export const useUpsertWalletHistory = () => {
  const upsert = walletHistoryClient.upsert;

  if (!upsert) {
    throw new Error("WalletHistoryのアップサート機能が利用できません");
  }

  return useUpsertDomain<WalletHistory, WalletHistoryCreateFields>(
    "walletHistories/upsert",
    upsert,
    "walletHistories",
  );
};
