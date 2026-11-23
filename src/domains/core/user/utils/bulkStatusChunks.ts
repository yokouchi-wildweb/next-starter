// src/domains/core/user/utils/bulkStatusChunks.ts
// 状態のまとめての変更を束に分けて送った結果を 1 つにまとめる(純粋な関数。hook useBulkChangeUserStatus が使う)。形は API の結果と同じ

import type { BulkChangeStatusResult } from "@/domains/core/user/types";

export function mergeBulkStatusResults(results: readonly BulkChangeStatusResult[], dryRun: boolean): BulkChangeStatusResult {
  return {
    dryRun,
    changed: results.flatMap((result) => result.changed),
    skipped: results.flatMap((result) => result.skipped),
    failed: results.flatMap((result) => result.failed),
  };
}
