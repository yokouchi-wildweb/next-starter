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
// ワンショット（バックフィル・データ移行）と、スケジュールに載せない任意タスクは scripts/tasks/<name>[.<fork の名前>].ts を走査する（./README.md）。
//
// package.json の task スクリプトは scripts/test/serverOnlyStub.mjs を preload する
// （タスクが `import "server-only"` を持つ server コードに届くため。テストと同じ理由）。

import path from "node:path";

import dotenv from "dotenv";

// env ファイルを読む（APP_ENV で指定、既定 .env.development）。タスク本体は動的 import なので、ここで読めば間に合う。
// 既に設定済みの環境変数は上書きしない。ファイルが無い環境（本番ホストで env を直接渡す場合）はそのまま進む。
dotenv.config({ path: process.env.APP_ENV || ".env.development", quiet: true });

import { matchesCronExpression } from "@/lib/cron/cronExpression";
import { readDeclaredForkIds } from "../../src/lib/forkOwnership/forkIds.mjs";
import { type LoadedCronTask, loadCronTasks } from "../cron/discover";
import { assertNoCronOverlap, listOneShotTasks, loadOneShotTask, type OneShotTaskFile, TASKS_DIR } from "./discover";

type TaskFn = () => Promise<Record<string, unknown>>;

/** pnpm task <name> で実行できる全タスク（定期 + ワンショット）。ワンショットは実行するときに該当のファイルだけ読み込む */
function buildTaskMap(repoRoot: string, cronTasks: LoadedCronTask[], oneShotTasks: OneShotTaskFile[]): Record<string, TaskFn> {
  assertNoCronOverlap(oneShotTasks, cronTasks.map((task) => task.name));
  const oneShot = oneShotTasks.map((file): [string, TaskFn] => [file.name, async () => (await loadOneShotTask(repoRoot, file)).run()]);
  return { ...Object.fromEntries(cronTasks.map((task) => [task.name, task.run])), ...Object.fromEntries(oneShot) };
}

function log(level: "info" | "error", payload: Record<string, unknown>) {
  const line = JSON.stringify({ level, scope: "task-cli", ...payload });
  if (level === "info") console.log(line);
  else console.error(line);
}

function printList(cronTasks: LoadedCronTask[], oneShotTasks: OneShotTaskFile[]) {
  console.log("Scheduled tasks (src/app/api/cron/*/task.ts):");
  for (const task of cronTasks) {
    const state = task.disabled ? " [off: override.ts]" : task.enabled && !task.enabled() ? " [disabled]" : "";
    const overridden = task.overridden && !task.disabled ? " (override.ts)" : "";
    console.log(`  - ${task.name} [${task.schedule}]${overridden}${state}: ${task.description}`);
  }
  console.log(`\nOne-shot / optional tasks (${TASKS_DIR}/<name>.ts):`);
  for (const { name } of oneShotTasks) {
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
  const repoRoot = path.resolve(import.meta.dirname, "../..");
  const cronTasks = await loadCronTasks(repoRoot);
  const oneShotTasks = listOneShotTasks(repoRoot, readDeclaredForkIds(repoRoot).all);
  const TASKS = buildTaskMap(repoRoot, cronTasks, oneShotTasks);

  if (!taskName || taskName === "--list" || taskName === "-l") {
    printList(cronTasks, oneShotTasks);
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
