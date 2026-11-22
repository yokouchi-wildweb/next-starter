// src/domains/walletHistory/hooks/useWalletHistory.ts

"use client";

import { useDomain } from "@/lib/crud";
import { walletHistoryClient } from "../services/client/walletHistoryClient";
import type { WalletHistory } from "../entities";

export const useWalletHistory = (id?: string | null) =>
  useDomain<WalletHistory | undefined>(
    id ? `walletHistory:${id}` : null,
    () => walletHistoryClient.get(id!) as Promise<WalletHistory>,
  );
