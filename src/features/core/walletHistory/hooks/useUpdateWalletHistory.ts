// src/features/walletHistory/hooks/useUpdateWalletHistory.ts

"use client";

import { useUpdateDomain } from "@/lib/crud/hooks";
import { walletHistoryClient } from "../services/client/walletHistoryClient";
import type { WalletHistory } from "../entities";
import type { WalletHistoryUpdateFields } from "../entities/form";

export const useUpdateWalletHistory = () =>
  useUpdateDomain<WalletHistory, WalletHistoryUpdateFields>(
    "walletHistories/update",
    walletHistoryClient.update,
    "walletHistories",
  );
