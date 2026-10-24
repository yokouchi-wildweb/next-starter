#!/usr/bin/env tsx
// scripts/tasks/run.ts
// 運用タスクを CLI から実行するための統合ランナー
// 定期実行（cron）タスクと、バックフィル・データ移行などのワンショットタスクの両方を扱う。
//
// 使い方:
//   pnpm task <task-name>
//   pnpm task expire-pending-purchases
//   pnpm task --list            # 登録済みタスク一覧
//   pnpm task --due             # 今の分（UTC）に schedule が一致する定期タスクを順に実行
//
// Vercel 以外のホスティング（Docker / AWS / オンプレ）では、
// 各社スケジューラ（EventBridge / Kubernetes CronJob / 自前 cron）から
// `pnpm task --due` を毎分 1 本だけ叩く（各タスクの schedule は CLI が判定する）。
//
// 定期タスクは src/app/api/cron/<name>/task.ts を走査して読み込む（ここには書かない。API ルートと同じ定義を使う）。
// 下記 ONE_SHOT_TASKS はワンショット（バックフィル・データ移行）と、スケジュールに載せない任意タスク。
//
// package.json の task スクリプトは scripts/test/serverOnlyStub.mjs を preload する
// （タスクが `import "server-only"` を持つ server コードに届くため。テストと同じ理由）。

import path from "node:path";

import dotenv from "dotenv";

// env ファイルを読む（APP_ENV で指定、既定 .env.development）。タスク本体は動的 import なので、ここで読めば間に合う。
// 既に設定済みの環境変数は上書きしない。ファイルが無い環境（本番ホストで env を直接渡す場合）はそのまま進む。
dotenv.config({ path: process.env.APP_ENV || ".env.development", quiet: true });

import { matchesCronExpression } from "@/lib/cron/cronExpression";
import { type LoadedCronTask, loadCronTasks } from "../cron/discover";

type TaskFn = () => Promise<Record<string, unknown>>;

/**
 * ワンショット・任意タスク
 * ここに追加 = pnpm task <name> で実行可能になる（定期実行はされない）
 */
const ONE_SHOT_TASKS: Record<string, TaskFn> = {
  "purchase-quota-cleanup": async () => {
    const { cleanupOldLedger } = await import(
      "@/features/core/purchaseQuota/services/server/wrappers/purchaseQuotaHelper"
    );
    const deleted = await cleanupOldLedger();
    return { deleted };
  },
  // 使い方: pnpm task analytics-rollup-backfill -- <metricKey> [--from YYYY-MM-DD] [--to YYYY-MM-DD]
  "analytics-rollup-backfill": async () => {
    const { backfillRollup } = await import(
      "@/features/core/analytics/services/server/rollup"
    );
    // pnpm は "--" をそのまま渡してくるため除去する
    const args = process.argv.slice(3).filter((arg) => arg !== "--");
    const metricKey = args[0];
    if (!metricKey || metricKey.startsWith("--")) {
      throw new Error(
        "使い方: pnpm task analytics-rollup-backfill -- <metricKey> [--from YYYY-MM-DD] [--to YYYY-MM-DD]",
      );
    }
    const readFlag = (name: string): string | undefined => {
      const index = args.indexOf(`--${name}`);
      return index >= 0 ? args[index + 1] : undefined;
    };
    return await backfillRollup({
      metricKey,
      from: readFlag("from"),
      to: readFlag("to"),
    });
  },
  // 導入時1回だけの初期化（定期実行しない。再実行は全ユーザーの失効カウントをリセットするので注意）
  "wallet-lots-init": async () => {
    const { initWalletLots } = await import(
      "@/features/core/wallet/services/server/lots/initWalletLots"
    );
    return await initWalletLots();
  },
  // 導入時1回だけの初期化（定期実行しない。wallet-lots-init の代替でどちらか一方だけ実行する）:
  // 付与履歴からロットを復元し、既に期限を過ぎた分を次回スイープの没収対象にする
  // 使い方: pnpm task wallet-lots-init-from-history -- --dry-run で対象確認 → dry-run なしで実行
  "wallet-lots-init-from-history": async () => {
    const { initWalletLotsFromHistory } = await import(
      "@/features/core/wallet/services/server/lots/initWalletLotsFromHistory"
    );
    const args = process.argv.slice(3);
    return await initWalletLotsFromHistory({ dryRun: args.includes("--dry-run") });
  },
  // 導入時1回だけの過去分復元（定期実行しない。冪等なので再実行は安全）
  "user-status-history-backfill": async () => {
    const { backfillStatusHistoryFromAuditLogs } = await import(
      "@/features/core/user/services/server/statusHistoryBackfill"
    );
    return await backfillStatusHistoryFromAuditLogs();
  },
  // 表示名の一意性 (USER_NAME_CONFIG.unique) 有効化時に1回だけ実行する既存重複の解消
  // （定期実行しない。冪等なので再実行は安全）
  // 使い方: pnpm task user-name-dedup -- --dry-run で対象確認 → dry-run なしで実行
  "user-name-dedup": async () => {
    const { dedupUserNames } = await import(
      "@/features/core/user/services/server/nameDedup"
    );
    const args = process.argv.slice(3);
    return await dedupUserNames({ dryRun: args.includes("--dry-run") });
  },
  // 登録端末のペアリングコードを CLI から発行する（管理画面を作る前の最初の 1 台・復旧用）。
  // 新しい端末を登録して発行するか、既存の端末（--device）に発行する（再ペアリング）。
  // 使い方: pnpm task paired-device-pair -- --kind <kind> --label <表示名> [--scope '<JSON>']
  //        pnpm task paired-device-pair -- --device <端末 id>
  "paired-device-pair": async () => {
    const { runAsSystem } = await import("@/lib/audit");
    const { createPairedDevice, issuePairingCode } = await import(
      "@/features/core/pairedDevice/services/server"
    );
    const args = process.argv.slice(3).filter((arg) => arg !== "--");
    const readFlag = (name: string): string | undefined => {
      const index = args.indexOf(`--${name}`);
      return index >= 0 ? args[index + 1] : undefined;
    };
    const usage =
      "使い方: pnpm task paired-device-pair -- --kind <kind> --label <表示名> [--scope '<JSON>'] | --device <端末 id>";
    return await runAsSystem(async () => {
      let deviceId = readFlag("device");
      if (!deviceId) {
        const kind = readFlag("kind");
        const label = readFlag("label");
        if (!kind || !label) throw new Error(usage);
        const scopeRaw = readFlag("scope");
        const scope = scopeRaw ? (JSON.parse(scopeRaw) as unknown) : undefined;
        const device = await createPairedDevice({ kind, label, scope }, "system");
        deviceId = device.id;
      }
      const issued = await issuePairingCode(deviceId, "system");
      return { deviceId, code: issued.code, expiresAt: issued.expiresAt.toISOString() };
    });
  },
};

/** pnpm task <name> で実行できる全タスク（定期 + ワンショット） */
function buildTaskMap(cronTasks: LoadedCronTask[]): Record<string, TaskFn> {
  for (const task of cronTasks) {
    if (task.name in ONE_SHOT_TASKS) {
      throw new Error(`タスク名 "${task.name}" が src/app/api/cron/ と ONE_SHOT_TASKS の両方にあります`);
    }
  }
  return { ...Object.fromEntries(cronTasks.map((task) => [task.name, task.run])), ...ONE_SHOT_TASKS };
}

function log(level: "info" | "error", payload: Record<string, unknown>) {
  const line = JSON.stringify({ level, scope: "task-cli", ...payload });
  if (level === "info") console.log(line);
  else console.error(line);
}

function printList(cronTasks: LoadedCronTask[]) {
  console.log("Scheduled tasks (src/app/api/cron/*/task.ts):");
  for (const task of cronTasks) {
    const state = task.disabled ? " [off: override.ts]" : task.enabled && !task.enabled() ? " [disabled]" : "";
    const overridden = task.overridden && !task.disabled ? " (override.ts)" : "";
    console.log(`  - ${task.name} [${task.schedule}]${overridden}${state}: ${task.description}`);
  }
  console.log("\nOne-shot / optional tasks (scripts/tasks/run.ts):");
  for (const name of Object.keys(ONE_SHOT_TASKS)) {
    console.log(`  - ${name}`);
  }
}

async function runTask(name: string, task: TaskFn): Promise<boolean> {
  const startedAt = Date.now();
  try {
    const result = await task();
    log("info", { task: name, ok: true, durationMs: Date.now() - startedAt, ...result });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("error", { task: name, ok: false, durationMs: Date.now() - startedAt, error: message });
    return false;
  }
}

/**
 * 今の分（UTC）に schedule が一致する定期タスクを順に実行する（Vercel 以外のスケジューラから毎分呼ぶ）。
 * 1 つ失敗しても残りは実行し、最後に exit 1 で失敗を知らせる。
 */
async function runDue(cronTasks: LoadedCronTask[]) {
  const now = new Date();
  let failed = 0;
  for (const task of cronTasks) {
    if (task.disabled || !matchesCronExpression(task.schedule, now)) continue;
    if (task.enabled && !task.enabled()) {
      log("info", { task: task.name, ok: true, skipped: true });
      continue;
    }
    if (!(await runTask(task.name, task.run))) failed += 1;
  }
  process.exit(failed > 0 ? 1 : 0);
}

async function main() {
  // pnpm は "--" をそのまま渡してくることがあるため除去する
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const taskName = args[0];
  const cronTasks = await loadCronTasks(path.resolve(import.meta.dirname, "../.."));
  const TASKS = buildTaskMap(cronTasks);

  if (!taskName || taskName === "--list" || taskName === "-l") {
    printList(cronTasks);
    if (!taskName) {
      console.log("\nUsage: pnpm task <task-name> | pnpm task --due");
      process.exit(1);
    }
    return;
  }

  if (taskName === "--due") {
    await runDue(cronTasks);
    return;
  }

  const task = TASKS[taskName];
  if (!task) {
    console.error(`Unknown task: ${taskName}`);
    console.error("Available tasks:", Object.keys(TASKS).join(", "));
    process.exit(1);
  }

  process.exit((await runTask(taskName, task)) ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
