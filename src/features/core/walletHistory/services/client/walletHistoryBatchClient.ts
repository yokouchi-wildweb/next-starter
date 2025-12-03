// src/features/walletHistory/services/client/walletHistoryBatchClient.ts

import axios from "axios";
import type { PaginatedResult } from "@/lib/crud/types";
import type { WalletHistoryBatchSummarySerialized } from "@/features/core/walletHistory/types/batch";

export type WalletHistoryBatchQuery = {
  userId?: string;
  page?: number;
  limit?: number;
};

export const walletHistoryBatchClient = {
  list: async (
    params: WalletHistoryBatchQuery,
  ): Promise<PaginatedResult<WalletHistoryBatchSummarySerialized>> => {
    const response = await axios.get<PaginatedResult<WalletHistoryBatchSummarySerialized>>(
      "/api/wallet/history/batches",
      { params },
    );
    return response.data;
  },
};
