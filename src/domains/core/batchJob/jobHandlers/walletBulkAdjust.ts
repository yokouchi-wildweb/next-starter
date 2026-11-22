// src/domains/core/batchJob/jobHandlers/walletBulkAdjust.ts
// ウォレット一括調整のジョブ(ジョブの作成は wallet の createWalletBulkAdjustJob)

import { gate } from "@/featureGate";
import { WALLET_BULK_ADJUST_JOB_TYPE } from "@/domains/core/wallet/constants/batchJob";
import { bulkAdjustByUsers, type BulkAdjustByUsersParams } from "@/domains/core/wallet/services/server/wrappers/bulkAdjustByUsers";

import { defineBatchJobHandler } from "../types";

export const jobHandler = defineBatchJobHandler<BulkAdjustByUsersParams>({
  jobType: WALLET_BULK_ADJUST_JOB_TYPE,
  enabled: () => gate.enabled("wallet"),
  processChunk: async (itemKeys, params, tx) => bulkAdjustByUsers(tx, itemKeys, params),
});
