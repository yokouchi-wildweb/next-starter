// src/features/walletHistory/hooks/useCreateWalletHistory.ts

"use client";

import { useCreateDomain } from "@/lib/crud/hooks";
import { walletHistoryClient } from "../services/client/walletHistoryClient";
import type { WalletHistory } from "../entities";
import type { WalletHistoryCreateFields } from "../entities/form";

export const useCreateWalletHistory = () =>
  useCreateDomain<WalletHistory, WalletHistoryCreateFields>("walletHistories/create", walletHistoryClient.create, "walletHistories");
