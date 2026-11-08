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
// 名指しの実行(ドメインのタスク・移行・定期タスク)は毎回 task_runs に記録し、止める鍵・結果不明・dry-run を効かせる（execute.ts、
// src/lib/task/README.md「実行の記録」）。--due（毎分の自動の回し）は記録しない。記録の行が書けなければ走らせない。
//
// package.json の task スクリプトは scripts/runner/preload/serverOnly.mjs を preload する
// （タスクが `import "server-only"` を持つ server コードに届くため。テストと同じ理由）。

import path from "node:path";

import { matchesCronExpression } from "@/lib/cron/cronExpression";
import { type LoadedCronTask, loadCronTasks } from "../../structure/cron/discover";
import { assertNoCronOverlap, listOneShotTasks, loadOneShotTask, type OneShotTaskFile } from "./discover";
import { type ExecuteOutcome, executeTask } from "./execute";
import { invocationOf } from "./invocation";
import { asSystem, loadEnvFile, requireDatabase } from "./prepare";
import { collectRunMeta } from "./record";
import { dbTaskRunStore, migrationKey, resolveByHand } from "./store";

// env ファイルを読む（prepare.ts）。タスク本体は動的 import なので、ここで読めば間に合う。
loadEnvFile();

type TaskFn = () => Promise<Record<string, unknown>>;

/** 名指しで打てる物: ドメインのタスク・移行(実行の記録あり)と定期タスク(名指しなら記録あり、--due は記録なし) */
type NamedTask = { kind: "oneShot"; file: OneShotTaskFile } | { kind: "cron"; task: LoadedCronTask };

function buildNamedTasks(cronTasks: LoadedCronTask[], oneShotTasks: OneShotTaskFile[]): Map<string, NamedTask> {
  assertNoCronOverlap(oneShotTasks, cronTasks.map((task) => task.name));
  const named = new Map<string, NamedTask>();
  for (const task of cronTasks) named.set(task.name, { kind: "cron", task });
  for (const file of oneShotTasks) named.set(file.name, { kind: "oneShot", file });
  return named;
}

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

/** 名指しの 1 回(実行の記録を書く)。終了コードを返す */
async function runNamed(repoRoot: string, name: string, named: NamedTask, args: string[]): Promise<number> {
  if (named.kind === "cron" && named.task.closedBy !== null) {
    // 機能が閉じた定期タスク: 本体を呼ばずに飛ばす(走らないので記録もしない。今までどおり exit 0)
    log("info", { task: name, ok: true, skipped: true, reason: "closed", rule: named.task.closedBy });
    return 0;
  }
  await requireDatabase("pnpm task");
  let run: TaskFn;
  let stopKeys: () => string[] | Promise<string[]>;
  let file: string;
  let kind: "task" | "migration" | "cron";
  if (named.kind === "cron") {
    const cron = named.task;
    run = cron.run;
    stopKeys = () => [];
    file = `src/app/api/cron/${cron.name}/task.ts`;
    kind = "cron";
  } else {
    const task = await loadOneShotTask(repoRoot, named.file);
    run = task.run;
    file = named.file.file;
    kind = named.file.kind;
    stopKeys = named.file.kind === "migration" ? () => [migrationKey(task.notice as string, name)] : () => (task.stopKeys ? task.stopKeys(args) : []);
  }
  const startedAt = Date.now();
  const outcome = await executeTask({
    name,
    kind,
    args,
    meta: collectRunMeta(repoRoot, file),
    stopKeys,
    run,
    asSystem: (requestId, fn) => asSystem(fn, requestId),
    store: await dbTaskRunStore(),
  });
  return report(name, outcome, Date.now() - startedAt);
}

function report(name: string, outcome: ExecuteOutcome, durationMs: number): number {
  if (outcome.kind === "not-recorded") {
    log("error", { task: name, ok: false, error: `実行の記録(task_runs)が書けないので走らせません: ${outcome.error}` });
    return 1;
  }
  if (outcome.kind === "refused") {
    const holders = outcome.holders.map((run) => ({ runId: run.id, status: run.status, startedAt: run.startedAt.toISOString(), keys: run.stopKeys }));
    log("error", {
      task: name,
      ok: false,
      refused: true,
      keys: outcome.keys,
      holders,
      error: "同じ止める鍵の実行が成功済み・結果不明・実行中です。走らせません(確かめた結果は pnpm task --resolve <runId> succeeded|failed)",
    });
    return 1;
  }
  const ok = outcome.status === "succeeded";
  const note = outcome.recordWritten ? {} : { recordNote: "結果を task_runs に書けませんでした(行は running のまま = 結果不明と同じに扱われる)" };
  log(ok ? "info" : "error", { task: name, ok, status: outcome.status, runId: outcome.runId, durationMs, ...(ok ? outcome.result : { error: outcome.error }), ...note });
  return ok ? 0 : 1;
}

/** pnpm task --resolve <runId> succeeded|failed: 人が確かめた結果で running / unknown の行を書き直す */
async function runResolve(rest: string[]): Promise<number> {
  const [runId, status] = rest;
  if (!runId || (status !== "succeeded" && status !== "failed")) {
    console.error("Usage: pnpm task --resolve <runId> succeeded|failed");
    return 1;
  }
  await requireDatabase("pnpm task --resolve");
  const row = await resolveByHand(runId, status, collectRunMeta(path.resolve(import.meta.dirname, "../../.."), null).actor);
  log("info", { resolved: true, runId: row.id, task: row.name, status: row.status });
  return 0;
}

async function main() {
  // pnpm は "--" をそのまま渡してくることがあるため除去する
  const invocation = invocationOf(process.argv.slice(2).filter((arg) => arg !== "--"));
  const repoRoot = path.resolve(import.meta.dirname, "../../..");
  const cronTasks = await loadCronTasks(repoRoot);
  const oneShotTasks = listOneShotTasks(repoRoot);
  const NAMED = buildNamedTasks(cronTasks, oneShotTasks);

  switch (invocation.kind) {
    case "list":
      printList(cronTasks, oneShotTasks);
      if (invocation.usage) {
        console.log("\nUsage: pnpm task <task-name> [-- <args>] | pnpm task --due | pnpm task --resolve <runId> succeeded|failed");
        process.exit(1);
      }
      return;
    case "due":
      // 毎分の自動の回し: 記録を書かない(L1.31)
      await runDue(cronTasks);
      return;
    case "resolve":
      process.exit(await runResolve(invocation.rest));
      return;
    case "named": {
      const named = NAMED.get(invocation.name);
      if (!named) {
        console.error(`Unknown task: ${invocation.name}`);
        console.error("Available tasks:", [...NAMED.keys()].join(", "));
        process.exit(1);
      }
      process.exit(await runNamed(repoRoot, invocation.name, named, invocation.rest));
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
