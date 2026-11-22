// 生成物・編集不可: pnpm generate extensions が src/domains/core/batchJob/extensionPoints.ts から生成する
// jobHandlers: src/domains/core/batchJob/jobHandlers/<名前>.ts(x) か <名前>/index.ts(x) の export const jobHandler(並びはファイル名の順)

import type { BatchJobHandlerItem } from "@/domains/core/batchJob/types";

import { jobHandler as jobHandlers_walletBulkAdjust } from "@/domains/core/batchJob/jobHandlers/walletBulkAdjust";

export const jobHandlers: BatchJobHandlerItem[] = [
  jobHandlers_walletBulkAdjust,
];
