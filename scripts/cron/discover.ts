// scripts/cron/discover.ts
// src/app/api/cron/<name>/ を走査して定期タスク定義を集める（一覧ファイルは持たない）
//
// 利用者: scripts/cron/generate.ts, scripts/cron/check.ts, scripts/tasks/run.ts（pnpm task）, scripts/cron/cronWiring.test.mjs
// task.ts の run は動的 import なので、ここで読み込んでも DB などの依存は読み込まれない。
// fork が置いた override.ts（任意）があれば、schedule の差し替えと disabled をここで反映する。

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { isValidCronExpression } from "@/lib/cron/cronExpression";
import type { CronTaskDefinition, CronTaskOverride } from "@/lib/cron/types";

export const CRON_ROUTE_DIR = "src/app/api/cron";

/** override.ts を反映したタスク定義 */
export type LoadedCronTask = CronTaskDefinition & {
  /** override.ts の disabled: true（定期実行しない） */
  disabled: boolean;
  /** override.ts があるか */
  overridden: boolean;
};

const OVERRIDE_KEYS = new Set(["schedule", "disabled"]);

/** src/app/api/cron 直下のディレクトリ名（= タスク名）を名前順に返す */
export function listCronTaskDirs(repoRoot: string): string[] {
  const root = path.join(repoRoot, CRON_ROUTE_DIR);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort();
}

async function loadOverride(dir: string, file: string): Promise<CronTaskOverride | null> {
  if (!existsSync(file)) return null;
  const label = `${CRON_ROUTE_DIR}/${dir}/override.ts`;
  const mod = (await import(pathToFileURL(file).href)) as { cronOverride?: CronTaskOverride };
  const override = mod.cronOverride;
  if (!override || typeof override !== "object") {
    throw new Error(`${label} が cronOverride を export していません`);
  }
  const unknown = Object.keys(override).filter((key) => !OVERRIDE_KEYS.has(key));
  if (unknown.length > 0) {
    throw new Error(`${label} に未知の項目があります: ${unknown.join(", ")}（書けるのは schedule / disabled）`);
  }
  if (override.schedule !== undefined && !isValidCronExpression(override.schedule)) {
    throw new Error(`${label} の schedule "${override.schedule}" が cron 式（5 フィールド・UTC）として不正です`);
  }
  if (override.disabled !== undefined && typeof override.disabled !== "boolean") {
    throw new Error(`${label} の disabled は true / false で書いてください`);
  }
  return override;
}

/**
 * 全タスクの task.ts（と、あれば override.ts）を読み込む。
 * task.ts が無い・`cronTask` を export していない・name がフォルダ名と違う・override.ts が不正な場合は throw
 * （vercel.json の生成や CLI が黙ってタスクを落とさないため）
 */
export async function loadCronTasks(repoRoot: string): Promise<LoadedCronTask[]> {
  const tasks: LoadedCronTask[] = [];
  for (const dir of listCronTaskDirs(repoRoot)) {
    const base = path.join(repoRoot, CRON_ROUTE_DIR, dir);
    const file = path.join(base, "task.ts");
    if (!existsSync(file)) {
      const hint = existsSync(path.join(base, "override.ts"))
        ? "（override.ts だけが残っている = upstream が消したタスクの上書き。override.ts も消す）"
        : "（cron のフォルダには route.ts と task.ts を置く）";
      throw new Error(`${CRON_ROUTE_DIR}/${dir}/task.ts がありません${hint}`);
    }
    const mod = (await import(pathToFileURL(file).href)) as { cronTask?: CronTaskDefinition };
    const task = mod.cronTask;
    if (!task || typeof task.run !== "function") {
      throw new Error(`${CRON_ROUTE_DIR}/${dir}/task.ts が cronTask を export していません`);
    }
    if (task.name !== dir) {
      throw new Error(`${CRON_ROUTE_DIR}/${dir}/task.ts の name "${task.name}" がフォルダ名と違います`);
    }
    const override = await loadOverride(dir, path.join(base, "override.ts"));
    tasks.push({
      ...task,
      schedule: override?.schedule ?? task.schedule,
      disabled: override?.disabled === true,
      overridden: override !== null,
    });
  }
  return tasks;
}

/** 定期実行するタスク（override.ts で disabled にしたものを除く） */
export function scheduledCronTasks(tasks: readonly LoadedCronTask[]): LoadedCronTask[] {
  return tasks.filter((task) => !task.disabled);
}
