// src/features/walletHistory/services/client/walletHistoryBatchClient.ts

import axios from "axios";
import type { PaginatedResult } from "@/lib/crud/types";
import type { WalletType } from "@/config/app/currency.config";
import type { WalletHistoryBatchSummarySerialized } from "@/features/core/walletHistory/types/batch";

export type WalletHistoryBatchQuery = {
  userId?: string;
  /** 通貨種別で絞り込む(省略時は全通貨)。通貨別の画面ではサーバー側で絞るため必ず指定する */
  type?: WalletType;
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
