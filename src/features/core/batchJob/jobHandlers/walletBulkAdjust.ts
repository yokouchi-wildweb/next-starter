// src/features/core/batchJob/jobHandlers/walletBulkAdjust.ts
// ウォレット一括調整のジョブ(ジョブの作成は wallet の createWalletBulkAdjustJob)

import { APP_FEATURES } from "@/config/app/app-features.config";
import { WALLET_BULK_ADJUST_JOB_TYPE } from "@/features/core/wallet/constants/batchJob";
import { bulkAdjustByUsers, type BulkAdjustByUsersParams } from "@/features/core/wallet/services/server/wrappers/bulkAdjustByUsers";

import { defineBatchJobHandler } from "../types";

export const jobHandler = defineBatchJobHandler<BulkAdjustByUsersParams>({
  jobType: WALLET_BULK_ADJUST_JOB_TYPE,
  enabled: () => APP_FEATURES.wallet.enabled,
  processChunk: async (itemKeys, params, tx) => bulkAdjustByUsers(tx, itemKeys, params),
});
