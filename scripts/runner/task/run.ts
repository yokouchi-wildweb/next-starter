#!/usr/bin/env tsx
// scripts/runner/task/run.ts
// 運用タスクを CLI から実行するための統合ランナー
// 定期実行（cron）タスクと、バックフィル・データ移行などのワンショットタスクの両方を扱う。
//
// 使い方:
//   pnpm task <task-name>
//   pnpm task expire-pending-purchases      # 定期タスク（平らな名前）
//   pnpm task wallet:lots-init -- --all      # ドメインのタスク・移行（<ドメイン>:<名前>）
//   pnpm task --list            # 登録済みタスク一覧
//   pnpm task --due             # 今の分（UTC）に schedule が一致する定期タスクを順に実行
//
// Vercel 以外のホスティング（Docker / AWS / オンプレ）では、
// 各社スケジューラ（EventBridge / Kubernetes CronJob / 自前 cron）から
// `pnpm task --due` を毎分 1 本だけ叩く（各タスクの schedule は CLI が判定する）。
//
// 定期タスクは src/app/api/cron/<name>/task.ts を走査して読み込む（ここには書かない。API ルートと同じ定義を使う）。
// 機能が閉じた定期タスク（住所 /api/cron/<name> を規則が閉じている。scripts/structure/cron/discover.ts の closedBy）は、--due でも名前指定でも飛ばす。
// ワンショット・任意タスクはドメインの src/features/<ドメイン>/scripts/tasks/<名前>.ts、1 回きりの移行は scripts/migrations/<名前>.ts を走査する
// （名前 = <ドメイン>:<名前>、src/lib/task/README.md）。
//
// package.json の task スクリプトは scripts/runner/preload/serverOnly.mjs を preload する
// （タスクが `import "server-only"` を持つ server コードに届くため。テストと同じ理由）。

import path from "node:path";

import { matchesCronExpression } from "@/lib/cron/cronExpression";
import { type LoadedCronTask, loadCronTasks } from "../../structure/cron/discover";
import { assertNoCronOverlap, listOneShotTasks, loadOneShotTask, type OneShotTaskFile } from "./discover";
import { loadEnvFile } from "./prepare";

// env ファイルを読む（prepare.ts）。タスク本体は動的 import なので、ここで読めば間に合う。
loadEnvFile();

type TaskFn = () => Promise<Record<string, unknown>>;

/** pnpm task <name> で実行できる全タスク（定期 + ワンショット）。ワンショットは実行するときに該当のファイルだけ読み込む */
function buildTaskMap(repoRoot: string, cronTasks: LoadedCronTask[], oneShotTasks: OneShotTaskFile[]): Record<string, TaskFn> {
  assertNoCronOverlap(oneShotTasks, cronTasks.map((task) => task.name));
  const oneShot = oneShotTasks.map((file): [string, TaskFn] => [file.name, async () => (await loadOneShotTask(repoRoot, file)).run()]);
  const cron = cronTasks.map((task): [string, TaskFn] => [task.name, task.closedBy === null ? task.run : closedTask(task.closedBy)]);
  return { ...Object.fromEntries(cron), ...Object.fromEntries(oneShot) };
}

/** 機能が閉じた定期タスクの代わり: 本体を呼ばずに飛ばした印を返す（終了コードは 0） */
const closedTask = (rule: string): TaskFn => async () => ({ skipped: true, reason: "closed", rule });

function log(level: "info" | "error", payload: Record<string, unknown>) {
  const line = JSON.stringify({ level, scope: "task-cli", ...payload });
  if (level === "info") console.log(line);
  else console.error(line);
}

function printList(cronTasks: LoadedCronTask[], oneShotTasks: OneShotTaskFile[]) {
  console.log("Scheduled tasks (src/app/api/cron/*/task.ts):");
  for (const task of cronTasks) {
    const state = task.disabled
      ? " [off: task.override.ts]"
      : task.closedBy !== null
        ? ` [closed: ${task.closedBy}]`
        : task.enabled && !task.enabled()
          ? " [disabled]"
          : "";
    const overridden = task.overridden && !task.disabled ? " (task.override.ts)" : "";
    console.log(`  - ${task.name} [${task.schedule}]${overridden}${state}: ${task.description}`);
  }
  console.log("\nDomain tasks (src/features/<domain>/scripts/tasks/<name>.ts):");
  for (const { name } of oneShotTasks.filter((task) => task.kind === "task")) {
    console.log(`  - ${name}`);
  }
  console.log("\nMigrations, one-off (src/features/<domain>/scripts/migrations/<name>.ts):");
  for (const { name } of oneShotTasks.filter((task) => task.kind === "migration")) {
    console.log(`  - ${name} [migration]`);
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
    if (task.closedBy !== null) {
      log("info", { task: task.name, ok: true, skipped: true, reason: "closed", rule: task.closedBy });
      continue;
    }
    if (task.enabled && !task.enabled()) {
      log("info", { task: task.name, ok: true, skipped: true, reason: "disabled" });
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
  const repoRoot = path.resolve(import.meta.dirname, "../../..");
  const cronTasks = await loadCronTasks(repoRoot);
  const oneShotTasks = listOneShotTasks(repoRoot);
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
