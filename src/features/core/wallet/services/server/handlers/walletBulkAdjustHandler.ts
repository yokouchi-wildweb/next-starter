// src/features/wallet/services/server/handlers/walletBulkAdjustHandler.ts

import { registerBatchJobHandler } from "@/features/batchJob/services/server/registry";
import { batchJobService } from "@/features/batchJob/services/server/batchJobService";
import { bulkAdjustByUsers, type BulkAdjustByUsersParams } from "../wrappers/bulkAdjustByUsers";
import type { BatchJobHandler, BatchJob } from "@/features/batchJob/types";
import type { WalletTypeValue } from "@/features/wallet/types/field";
import type { WalletHistoryChangeMethodValue, WalletHistorySourceTypeValue } from "@/features/walletHistory/types/field";
import type { ReasonCategory } from "@/config/app/wallet-reason-category.config";

export const WALLET_BULK_ADJUST_JOB_TYPE = "wallet_bulk_adjust";

const handler: BatchJobHandler<BulkAdjustByUsersParams> = {
  processChunk: async (itemKeys, params, tx) => {
    return bulkAdjustByUsers(tx, itemKeys, params);
  },
};

registerBatchJobHandler(WALLET_BULK_ADJUST_JOB_TYPE, handler);

// --- ファサード: ダウンストリーム向け型安全なジョブ作成 ---

type CreateWalletBulkAdjustJobInput = {
  jobKey: string;
  userIds: string[];
  walletType: WalletTypeValue;
  changeMethod: WalletHistoryChangeMethodValue;
  amount: number;
  sourceType?: WalletHistorySourceTypeValue;
  reason?: string;
  reasonCategory?: ReasonCategory;
  meta?: Record<string, unknown>;
  batchSize?: number;
};

/**
 * ウォレット一括調整バッチジョブを作成する。
 * ダウンストリームはこの関数を使うことで、jobTypeやparams構造を知る必要がない。
 */
export async function createWalletBulkAdjustJob(input: CreateWalletBulkAdjustJobInput): Promise<BatchJob> {
  return batchJobService.createJob({
    jobType: WALLET_BULK_ADJUST_JOB_TYPE,
    jobKey: input.jobKey,
    itemKeys: input.userIds,
    batchSize: input.batchSize,
    params: {
      walletType: input.walletType,
      changeMethod: input.changeMethod,
      amount: input.amount,
      sourceType: input.sourceType ?? "system",
      reason: input.reason,
      reasonCategory: input.reasonCategory,
      meta: input.meta,
    } satisfies BulkAdjustByUsersParams,
  });
}
