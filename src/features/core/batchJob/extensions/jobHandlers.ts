// 生成物・編集不可: pnpm extensions:generate が src/features/core/batchJob/extensionPoints.ts から生成する
// jobHandlers: src/features/core/batchJob/jobHandlers/<名前>[.<fork の名前>].ts(x) か <名前>[.<fork の名前>]/index.ts(x) の export const jobHandler(並びはファイル名の順)

import type { BatchJobHandlerItem } from "@/features/core/batchJob/types";

import { jobHandler as walletBulkAdjust } from "@/features/core/batchJob/jobHandlers/walletBulkAdjust";

export const jobHandlers: BatchJobHandlerItem[] = [
  walletBulkAdjust,
];
