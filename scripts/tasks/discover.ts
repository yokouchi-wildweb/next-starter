// scripts/tasks/discover.ts
// scripts/tasks 直下の <name>[.<fork の名前>].ts を走査してワンショット・任意タスクを集める(一覧ファイルは持たない)。
//
// タスク名はファイル名で決まるので、一覧と名前の検査はファイルを読み込まない。実行するタスクのファイルだけを読み込む。
// 利用者: scripts/tasks/run.ts(pnpm task)

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { OneShotTask } from "./types";

export const TASKS_DIR = "scripts/tasks";

/** 受け口の直下にある、タスクでないファイル */
const RUNNER_FILES = new Set(["run.ts", "discover.ts", "types.ts"]);
const TASK_FILE = /^([a-z][a-z0-9]*(?:-[a-z0-9]+)*)(?:\.([a-z0-9]+(?:-[a-z0-9]+)*))?\.ts$/;

export type OneShotTaskFile = {
  name: string;
  /** リポジトリ直下からの相対 */
  file: string;
};

/**
 * タスクのファイルを名前順に返す
 * @param forkIds 宣言済みの fork の名前(src/lib/forkOwnership/forkIds.mjs の readDeclaredForkIds().all)
 */
export function listOneShotTasks(repoRoot: string, forkIds: readonly string[]): OneShotTaskFile[] {
  const root = path.join(repoRoot, TASKS_DIR);
  if (!existsSync(root)) return [];
  const byName = new Map<string, string>();
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isFile() || RUNNER_FILES.has(entry.name) || /\.test\.[cm]?ts$/.test(entry.name) || !entry.name.endsWith(".ts")) continue;
    const file = `${TASKS_DIR}/${entry.name}`;
    const match = TASK_FILE.exec(entry.name);
    if (!match) throw new Error(`${file}: タスクのファイル名は <kebab-case の名前>[.<fork の名前>].ts`);
    const [, name, forkId] = match;
    if (forkId && !forkIds.includes(forkId)) {
      throw new Error(`${file}: fork の名前 "${forkId}" は宣言されていない(.claude/rules/project.md の fork_id: か祖先の台帳名)`);
    }
    const other = byName.get(name);
    if (other) throw new Error(`タスク名 "${name}" が ${other} と ${file} の両方にあります`);
    byName.set(name, file);
  }
  return [...byName.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([name, file]) => ({ name, file }));
}

/** 定期タスクと同じ名前のタスクがあれば失敗 */
export function assertNoCronOverlap(tasks: readonly OneShotTaskFile[], cronNames: readonly string[]): void {
  for (const task of tasks) {
    if (cronNames.includes(task.name)) {
      throw new Error(`タスク名 "${task.name}" が src/app/api/cron/ と ${task.file} の両方にあります`);
    }
  }
}

/** タスクのファイルを読み込む(export const task と名前を確かめる) */
export async function loadOneShotTask(repoRoot: string, { name, file }: OneShotTaskFile): Promise<OneShotTask> {
  const mod = (await import(pathToFileURL(path.join(repoRoot, file)).href)) as { task?: OneShotTask };
  const task = mod.task;
  if (!task || typeof task.run !== "function") throw new Error(`${file} が export const task を持っていません`);
  if (task.name !== name) throw new Error(`${file} の task.name "${task.name}" がファイル名の "${name}" と違います`);
  return task;
}
