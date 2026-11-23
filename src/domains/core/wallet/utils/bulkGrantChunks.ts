// src/domains/core/wallet/utils/bulkGrantChunks.ts
// まとめての付与・補填を束に分けて送った結果を 1 つにまとめる(純粋な関数。hook useBulkGrantWallet が使う)。
// 束ごとに transaction と request_batch_id が分かれるので、まとめた結果は束の一覧 requestBatchIds を持つ(取り消しは束ごと)

import type { BulkGrantResult } from "@/domains/core/wallet/services/types";

/** 束に分けて送ったまとめての付与の結果(API の結果の requestBatchId の代わりに、書いた束の requestBatchIds) */
export type BulkGrantRunResult = Omit<BulkGrantResult, "requestBatchId"> & {
  /** 書いた束の request_batch_id(束の順。dryRun では空)。取り消しは束ごとに wallet:reverse-history -- --batch */
  requestBatchIds: string[];
};

export function mergeBulkGrantResults(results: readonly BulkGrantResult[], dryRun: boolean): BulkGrantRunResult {
  return {
    dryRun,
    requestBatchIds: results.flatMap((result) => (result.requestBatchId ? [result.requestBatchId] : [])),
    granted: results.flatMap((result) => result.granted),
    skipped: results.flatMap((result) => result.skipped),
    total: results.reduce((sum, result) => sum + result.total, 0),
    notified: results.reduce((sum, result) => sum + result.notified, 0),
    notifyFailed: results.flatMap((result) => result.notifyFailed),
  };
}
