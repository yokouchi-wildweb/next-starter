// src/features/wallet/hooks/useUpdateWallet.ts

"use client";

import { useUpdateDomain } from "@/lib/crud/hooks";
import { walletClient } from "../services/client/walletClient";
import type { Wallet } from "../entities";
import type { WalletUpdateFields } from "../entities/form";

export const useUpdateWallet = () =>
  useUpdateDomain<Wallet, WalletUpdateFields>(
    "wallets/update",
    walletClient.update,
    "wallets",
  );
