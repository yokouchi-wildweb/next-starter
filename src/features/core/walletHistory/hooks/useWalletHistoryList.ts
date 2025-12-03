// src/features/walletHistory/hooks/useWalletHistoryList.ts

"use client";

import { useDomainList } from "@/lib/crud/hooks";
import { walletHistoryClient } from "../services/client/walletHistoryClient";
import type { WalletHistory } from "../entities";
import type { SWRConfiguration } from "swr";

export const useWalletHistoryList = (config?: SWRConfiguration) =>
  useDomainList<WalletHistory>("walletHistories", walletHistoryClient.getAll, config);
