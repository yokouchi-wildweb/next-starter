// src/features/core/messaging/scripts/migrations/copy-legacy-notifications.ts
// 前のお知らせの表(notifications・notification_reads・notification_read_states・notification_templates)の中身を新しい表
// (回 message_dispatches・お知らせの行 message_inbox_items・既読・watermark・テンプレートと版)へ写し、古い送る口の回の古い列を
// 同じ行の新しい列へ写す。最後に数を突き合わせ(照合)、結果を task_runs に残す(S3 の古い表の DROP はこの記録を見る)。
// 手順: 古いアプリの書き込みを止める → merge・再生成 → pnpm db:push → pnpm task messaging:copy-legacy-notifications
//   (incomplete = 予算で止まった → 同じ命令をもう一度。続きから写す)→ 照合が ok の succeeded の行が残れば済み
// 冪等: 新しい行の id は写し元の id から決まり、ON CONFLICT DO NOTHING で書く。何度打っても同じ結果
// 引数: --dry-run(書かずに数えるだけ)、--budget-ms=<ms>(1 回の時間予算、既定 240000)
// 流れ: lib.legacyCopy.ts、列の対応: lib.legacyCopyMap.ts、置き場: lib.legacyCopyStore.ts、説明: ../../README.md「旧お知らせの写し」

import { type OneShotTask, TaskNotStartedError } from "@/lib/task";

/**
 * 案内する notice の id(仮の id。形だけ notice の id に合わせてある。この写しを出す notice の指令が本当の id に書き換える)。
 * 止める鍵 migration:<この id>:messaging:copy-legacy-notifications は照合が ok の成功で取る(incomplete・failed は取らない)
 */
export const LEGACY_COPY_NOTICE_ID = "20261111-000000-messaging-legacy-copy";

export const task: OneShotTask = {
  name: "messaging:copy-legacy-notifications",
  notice: LEGACY_COPY_NOTICE_ID,
  run: async () => {
    const { parseLegacyCopyArgs, runLegacyCopy } = await import("./lib.legacyCopy");
    const options = parseLegacyCopyArgs(process.argv.slice(3).filter((arg) => arg !== "--"));
    if (!Number.isFinite(options.budgetMs) || options.budgetMs <= 0) {
      throw new TaskNotStartedError("--budget-ms= は正の数(ミリ秒)で指定します");
    }
    const { drizzleLegacyCopyStore } = await import("./lib.legacyCopyStore");
    return runLegacyCopy(drizzleLegacyCopyStore, options);
  },
};
