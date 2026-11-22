// 生成物・編集不可: pnpm generate extensions が src/domains/core/batchJob/extensionPoints.ts から生成する
// batchJobJobHandlers: 差す側の <ドメイン>/plugs/batchJobJobHandlers/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const jobHandler(並びは<差す側>/<名前> の順、常に読む: gate.plugs を掛けず項目の enabled で閉じる)

import type { BatchJobHandlerItem } from "@/domains/core/batchJob/types";

import { jobHandler as batchJobJobHandlers_wallet_walletBulkAdjust } from "@/domains/core/wallet/plugs/batchJobJobHandlers/walletBulkAdjust";

export const batchJobJobHandlers: { domain: string | null; name: string; requires: readonly string[]; plug: BatchJobHandlerItem }[] = [
  { domain: "wallet", name: "walletBulkAdjust", requires: [], plug: batchJobJobHandlers_wallet_walletBulkAdjust },
];
