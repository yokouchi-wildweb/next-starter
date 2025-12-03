// src/features/walletHistory/hooks/useDeleteWalletHistory.ts

"use client";

import { useDeleteDomain } from "@/lib/crud/hooks";
import { walletHistoryClient } from "../services/client/walletHistoryClient";

export const useDeleteWalletHistory = () => useDeleteDomain("walletHistories/delete", walletHistoryClient.delete, "walletHistories");
