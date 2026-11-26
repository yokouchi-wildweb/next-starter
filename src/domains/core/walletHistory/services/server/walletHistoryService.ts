// src/domains/walletHistory/services/server/walletHistoryService.ts

import { walletHistoryBase } from "./walletHistoryBase";
import { listBatchSummaries, type ListBatchSummariesParams } from "./listBatchSummaries";
import type { WalletHistoryBatchSummary } from "@/domains/core/walletHistory/types/batch";

export const walletHistoryService = {
  ...walletHistoryBase,
  listBatchSummaries: (params: ListBatchSummariesParams): Promise<{ items: WalletHistoryBatchSummary[]; total: number }> =>
    listBatchSummaries(params),
};
