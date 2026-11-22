// src/domains/walletHistory/services/server/walletHistoryService.ts

import { base } from "./drizzleBase";
import { listBatchSummaries, type ListBatchSummariesParams } from "./listBatchSummaries";
import type { WalletHistoryBatchSummary } from "@/domains/core/walletHistory/types/batch";

export const walletHistoryService = {
  ...base,
  listBatchSummaries: (params: ListBatchSummariesParams): Promise<{ items: WalletHistoryBatchSummary[]; total: number }> =>
    listBatchSummaries(params),
};
