// src/features/core/wallet/scripts/tasks/reverse-history.ts
// 取引の取り消し(運用コマンド): 履歴の行を逆向きの調整で打ち消す。中身は walletService.reverseHistory(README「取引の取り消し」)
// 使い方: pnpm task wallet:reverse-history -- --history <id>[,<id>...] | --batch <request_batch_id> --reason "<理由>" [--dry-run]
//   まず --dry-run で計画(ユーザー・通貨・増減・残高の前後)を確かめ、--dry-run を外して実行する
// 止める鍵: 取り消す行ごとに wallet-reverse:<行の id>(同じ行を二度取り消さない。束は行の id に開く)
// 失敗: 取り消しは 1 つの transaction なので、確かめで止まった・途中で落ちた時は何も書いていない → 鍵を取らずに failed(直して打ち直せる)

import { REVERSE_HISTORY_USAGE, readReverseHistoryArgs, reverseHistoryStopKeys } from "./lib.reverseHistoryArgs";
import { TaskNotStartedError, type OneShotTask } from "@/lib/task";

const argsOf = (args?: string[]) => (args ?? process.argv.slice(3)).filter((arg) => arg !== "--");

/** サービスの DomainError(確かめで止めた・transaction ごと戻った)を「書く前に止まった」にする */
async function notStartedOnDomainError<T>(work: () => Promise<T>): Promise<T> {
  const { DomainError } = await import("@/lib/errors");
  try {
    return await work();
  } catch (error) {
    if (error instanceof DomainError) throw new TaskNotStartedError(`wallet:reverse-history: ${error.message}\n使い方: ${REVERSE_HISTORY_USAGE}`);
    throw error;
  }
}

export const task: OneShotTask = {
  name: "wallet:reverse-history",
  stopKeys: async (args) => {
    const parsed = readReverseHistoryArgs(argsOf(args));
    if (parsed.historyIds) return reverseHistoryStopKeys(parsed.historyIds);
    // 束は行の id に開く(確かめと計画だけ、何も書かない)
    const { walletService } = await import("@/features/core/wallet/services/server/walletService");
    const planned = await notStartedOnDomainError(() => walletService.reverseHistory({ ...parsed, dryRun: true }));
    return reverseHistoryStopKeys(planned.rows.map((row) => row.historyId));
  },
  run: async () => {
    const parsed = readReverseHistoryArgs(argsOf());
    const { walletService } = await import("@/features/core/wallet/services/server/walletService");
    const result = await notStartedOnDomainError(() => walletService.reverseHistory(parsed));
    for (const row of result.rows) {
      console.log(
        `${result.dryRun ? "[dry-run] " : ""}${row.historyId}: ${row.userId} ${row.walletType} ${row.delta > 0 ? "+" : ""}${row.delta}` +
          ` (残高 ${row.balanceBefore} → ${row.balanceAfter})${row.newHistoryId ? ` 取り消しの行 ${row.newHistoryId}` : ""}`,
      );
    }
    return { dryRun: result.dryRun, requestBatchId: result.requestBatchId, reversed: result.rows.length, rows: result.rows };
  },
};
