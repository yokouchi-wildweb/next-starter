// scripts/cron/discover.ts
// src/app/api/cron/<name>/task.ts を走査して定期タスク定義を集める（一覧ファイルは持たない）
//
// 利用者: scripts/cron/generate.ts, scripts/cron/check.ts, scripts/tasks/run.ts（pnpm task）, scripts/cron/cronWiring.test.mjs
// task.ts の run は動的 import なので、ここで読み込んでも DB などの依存は読み込まれない。

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { CronTaskDefinition } from "@/lib/cron/types";

export const CRON_ROUTE_DIR = "src/app/api/cron";

/** src/app/api/cron 直下のディレクトリ名（= タスク名）を名前順に返す */
export function listCronTaskDirs(repoRoot: string): string[] {
  const root = path.join(repoRoot, CRON_ROUTE_DIR);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort();
}

/**
 * 全タスクの task.ts を読み込む。task.ts が無い・`cronTask` を export していない・name がフォルダ名と違う場合は throw
 * （vercel.json の生成や CLI が黙ってタスクを落とさないため）
 */
export async function loadCronTasks(repoRoot: string): Promise<CronTaskDefinition[]> {
  const tasks: CronTaskDefinition[] = [];
  for (const dir of listCronTaskDirs(repoRoot)) {
    const file = path.join(repoRoot, CRON_ROUTE_DIR, dir, "task.ts");
    if (!existsSync(file)) {
      throw new Error(`${CRON_ROUTE_DIR}/${dir}/task.ts がありません（cron のフォルダには route.ts と task.ts を置く）`);
    }
    const mod = (await import(pathToFileURL(file).href)) as { cronTask?: CronTaskDefinition };
    const task = mod.cronTask;
    if (!task || typeof task.run !== "function") {
      throw new Error(`${CRON_ROUTE_DIR}/${dir}/task.ts が cronTask を export していません`);
    }
    if (task.name !== dir) {
      throw new Error(`${CRON_ROUTE_DIR}/${dir}/task.ts の name "${task.name}" がフォルダ名と違います`);
    }
    tasks.push(task);
  }
  return tasks;
}
