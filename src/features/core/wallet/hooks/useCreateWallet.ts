// src/features/wallet/hooks/useCreateWallet.ts

"use client";

import { useCreateDomain } from "@/lib/crud/hooks";
import { walletClient } from "../services/client/walletClient";
import type { Wallet } from "../entities";
import type { WalletCreateFields } from "../entities/form";

export const useCreateWallet = () =>
  useCreateDomain<Wallet, WalletCreateFields>("wallets/create", walletClient.create, "wallets");
