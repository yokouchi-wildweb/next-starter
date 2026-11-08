// src/features/core/wallet/scripts/tasks/bulk-grant.ts
// 一括付与と補填(運用コマンド)。中身は walletService.bulkGrant(README「一括付与と補填」)
// 使い方: pnpm task wallet:bulk-grant -- --wallet-type <通貨> --kind grant|compensation
//   (--users <id>[,...] --amount <n> | --file <1 行 "id" か "id,額"> [--amount <既定の額>]) --reason "<理由>" [--notify] [--dry-run]
//   まず --dry-run で人数・合計・飛ばす人を確かめ、--dry-run を外して実行する
// 止める鍵: 中身(通貨・種類・理由・ユーザーと額)から 1 つ = wallet-grant:<hash>。同じ付与を二度打たない
// 間違えた付与の取り消し: pnpm task wallet:reverse-history -- --batch <結果の requestBatchId> --reason "<理由>"
// 失敗: 全員を 1 つの transaction で書くので、止まった・落ちた時は何も書いていない → 鍵を取らずに failed(直して打ち直せる)

import { BULK_GRANT_USAGE, bulkGrantStopKey, readBulkGrantArgs } from "./lib.bulkGrantArgs";
import { TaskNotStartedError, type OneShotTask } from "@/lib/task";

const argsOf = (args?: string[]) => (args ?? process.argv.slice(3)).filter((arg) => arg !== "--");

export const task: OneShotTask = {
  name: "wallet:bulk-grant",
  stopKeys: (args) => [bulkGrantStopKey(readBulkGrantArgs(argsOf(args)))],
  run: async () => {
    const parsed = readBulkGrantArgs(argsOf());
    const { walletService } = await import("@/features/core/wallet/services/server/walletService");
    const { DomainError } = await import("@/lib/errors/domainError");
    let result;
    try {
      result = await walletService.bulkGrant({ ...parsed, walletType: parsed.walletType as never });
    } catch (error) {
      // 先の確かめで止めた・transaction ごと戻った = 何も書いていない
      if (error instanceof DomainError) throw new TaskNotStartedError(`wallet:bulk-grant: ${error.message}\n使い方: ${BULK_GRANT_USAGE}`);
      throw error;
    }
    const mark = result.dryRun ? "[dry-run] " : "";
    for (const row of result.skipped) console.log(`${mark}飛ばす ${row.userId}: ${row.why}`);
    for (const row of result.notifyFailed) console.error(`お知らせの失敗 ${row.userId}: ${row.error}(付与は済んでいる)`);
    console.log(
      `${mark}${parsed.walletType} を ${result.granted.length} 人に${result.dryRun ? "付ける" : "付けた"}(合計 ${result.total}、種類 ${parsed.kind})/ 飛ばす ${result.skipped.length} 人` +
        (result.requestBatchId ? ` / request_batch_id ${result.requestBatchId}(取り消しは wallet:reverse-history -- --batch)` : "") +
        (parsed.notify && !result.dryRun ? ` / お知らせ ${result.notified} 人` : ""),
    );
    return {
      dryRun: result.dryRun,
      requestBatchId: result.requestBatchId,
      granted: result.granted.length,
      total: result.total,
      skipped: result.skipped,
      notified: result.notified,
      notifyFailed: result.notifyFailed,
    };
  },
};
