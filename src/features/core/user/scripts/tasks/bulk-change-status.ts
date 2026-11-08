// src/features/core/user/scripts/tasks/bulk-change-status.ts
// ステータスの一括変更(運用コマンド)。中身は userService.bulkChangeStatus(README「ステータスの一括変更」)
// 使い方: pnpm task user:bulk-change-status -- --to <状態> (--users <id>[,...] | --file <path>) --reason "<理由>" [--from <状態>] [--dry-run]
//   まず --dry-run で変わる人数と飛ばす人(理由つき)を確かめ、--dry-run を外して実行する
// 止める鍵は無い: 打ち直すと既に変わった人を飛ばすので、途中で落ちても同じ指定で打ち直せる

import { BULK_CHANGE_STATUS_USAGE, readBulkChangeStatusArgs } from "./lib.bulkChangeStatusArgs";
import { TaskNotStartedError, type OneShotTask } from "@/lib/task";

export const task: OneShotTask = {
  name: "user:bulk-change-status",
  run: async () => {
    const parsed = readBulkChangeStatusArgs(process.argv.slice(3).filter((arg) => arg !== "--"));
    const { userService } = await import("@/features/core/user/services/server/userService");
    const { DomainError } = await import("@/lib/errors");
    let result;
    try {
      result = await userService.bulkChangeStatus(parsed);
    } catch (error) {
      // 先の確かめ(変える先・理由・重なり)で止めた = 何も書いていない
      if (error instanceof DomainError) throw new TaskNotStartedError(`user:bulk-change-status: ${error.message}\n使い方: ${BULK_CHANGE_STATUS_USAGE}`);
      throw error;
    }
    const mark = result.dryRun ? "[dry-run] " : "";
    for (const row of result.skipped) console.log(`${mark}飛ばす ${row.userId}: ${row.why}`);
    for (const row of result.failed) console.error(`失敗 ${row.userId}: ${row.error}`);
    console.log(`${mark}${parsed.newStatus} に${result.dryRun ? "変える" : "変えた"} ${result.changed.length} 人 / 飛ばす ${result.skipped.length} 人 / 失敗 ${result.failed.length} 人`);
    if (result.failed.length > 0) {
      throw new Error(`${result.failed.length} 人の変更に失敗しました(他の人は変えた。同じ指定で打ち直すと、変わった人は飛ばす)`);
    }
    return { dryRun: result.dryRun, newStatus: parsed.newStatus, changed: result.changed.length, skipped: result.skipped, failed: result.failed };
  },
};
