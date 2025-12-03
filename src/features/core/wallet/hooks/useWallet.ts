// src/features/wallet/hooks/useWallet.ts

"use client";

import { useDomain } from "@/lib/crud/hooks";
import { walletClient } from "../services/client/walletClient";
import type { Wallet } from "../entities";

export const useWallet = (id?: string | null) =>
  useDomain<Wallet | undefined>(
    id ? `wallet:${id}` : null,
    () => walletClient.getById(id!) as Promise<Wallet>,
  );
