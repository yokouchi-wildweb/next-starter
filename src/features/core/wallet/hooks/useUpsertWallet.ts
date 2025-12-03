// src/features/wallet/hooks/useUpsertWallet.ts

"use client";

import { useUpsertDomain } from "@/lib/crud/hooks";
import { walletClient } from "../services/client/walletClient";
import type { Wallet } from "../entities";
import type { WalletCreateFields } from "../entities/form";

export const useUpsertWallet = () => {
  const upsert = walletClient.upsert;

  if (!upsert) {
    throw new Error("Walletのアップサート機能が利用できません");
  }

  return useUpsertDomain<Wallet, WalletCreateFields>(
    "wallets/upsert",
    upsert,
    "wallets",
  );
};
