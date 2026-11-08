// scripts/runner/task/discover.ts
// ドメインのタスク・移行(src/features/<ドメイン>/scripts/{tasks,migrations}/<名前>.ts)を集め、実行するファイルだけを読み込む。
// 走査そのものは scan.mjs(一覧ファイルは持たない。一覧と名前の検査はファイルを読み込まない)。
// 利用者: scripts/runner/task/run.ts(pnpm task)

import path from "node:path";
import { pathToFileURL } from "node:url";

import { scanTasks } from "./scan.mjs";

import type { OneShotTask } from "../../../src/lib/task";

export type OneShotTaskKind = "task" | "migration";

export type OneShotTaskFile = {
  /** <ドメイン>:<名前> */
  name: string;
  domain: string;
  /** task = scripts/tasks/、migration = scripts/migrations/ */
  kind: OneShotTaskKind;
  /** リポジトリ直下からの相対 */
  file: string;
};

/** タスクと移行を名前順に返す。置き方の誤り(名前の形・同じ名前・古い置き場 scripts/tasks の残り)は全部並べて止める */
export function listOneShotTasks(repoRoot: string): OneShotTaskFile[] {
  const { tasks, problems } = scanTasks(repoRoot) as { tasks: OneShotTaskFile[]; problems: string[] };
  if (problems.length > 0) throw new Error(problems.join("\n"));
  return tasks;
}

/** 定期タスクと同じ名前のタスクがあれば失敗(ドメインのタスクは <ドメイン>:<名前> なので、平らな名前の定期タスクとは本来重ならない) */
export function assertNoCronOverlap(tasks: readonly OneShotTaskFile[], cronNames: readonly string[]): void {
  for (const task of tasks) {
    if (cronNames.includes(task.name)) {
      throw new Error(`タスク名 "${task.name}" が src/app/api/cron/ と ${task.file} の両方にあります`);
    }
  }
}

/** タスクのファイルを読み込む(export const task と、task.name = <ドメイン>:<ファイル名> を確かめる) */
export async function loadOneShotTask(repoRoot: string, { name, file }: OneShotTaskFile): Promise<OneShotTask> {
  const mod = (await import(pathToFileURL(path.join(repoRoot, file)).href)) as { task?: OneShotTask };
  const task = mod.task;
  if (!task || typeof task.run !== "function") throw new Error(`${file} が export const task を持っていません`);
  if (task.name !== name) throw new Error(`${file} の task.name "${task.name}" が "${name}"(<ドメイン>:<ファイル名>)と違います`);
  return task;
}
