// src/features/core/walletHistory/types/batch.ts

import type { WalletHistory } from "@/features/core/walletHistory/entities";
import type { ReasonCategory } from "@/config/app/wallet-reason-category.config";

export type WalletHistoryBatchSummary = {
  batchId: string;
  requestBatchId: string | null;
  userId: string;
  type: WalletHistory["type"];
  startedAt: Date;
  completedAt: Date;
  balanceBefore: number;
  balanceAfter: number;
  totalDelta: number;
  changeMethods: WalletHistory["change_method"][];
  sourceTypes: WalletHistory["source_type"][];
  reasonCategories: ReasonCategory[];
  records: WalletHistory[];
};

export type WalletHistoryBatchSummarySerialized = Omit<
  WalletHistoryBatchSummary,
  "startedAt" | "completedAt"
> & {
  startedAt: string;
  completedAt: string;
};
