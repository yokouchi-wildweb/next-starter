// src/lib/cron/discover.ts — cron の task を探す処理(node 用の入口。生成器・検査 scripts/structure/cron と pnpm task が共有する)
// src/app/api/cron/<name>/ を走査して定期タスク定義を集める（一覧ファイルは持たない）。
// task.ts の run は動的 import なので、ここで読み込んでも DB などの依存は読み込まれない。
// fork が置いた task.override.ts（任意。task.ts の一部の上書き = <対象>.override.ts の形）があれば、schedule の差し替えと
// disabled をここで反映する。空(空白とコメントだけ)は不在と同じ。旧名の override.ts が残っていれば改名を案内して止める。
// 機能の門: タスクの住所 /api/cron/<name> が閉じているかは呼ぶ側が closedBy で渡す(この lib は門番を読まない。
// scripts は scripts/structure/cron/discover.ts が門番 gate.path を結ぶ。route 側は src/wiring/cronRoute.ts が同じ住所で判定する)。
// server-only ではない(node:fs を使うのでアプリの画面からは読まない)。
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { isValidCronExpression } from "./cronExpression";
import type { CronTaskDefinition, CronTaskOverride } from "./types";
import { cronTaskPath } from "./vercelCrons";

export const CRON_ROUTE_DIR = "src/app/api/cron";
/** fork の上書きのファイル名(task.ts の一部の上書き) */
export const CRON_OVERRIDE_FILE = "task.override.ts";
/** 旧名(残っていれば改名を案内して止める) */
const LEGACY_OVERRIDE_FILE = "override.ts";

/** task.override.ts を反映したタスク定義 */
export type LoadedCronTask = CronTaskDefinition & {
  /** task.override.ts の disabled: true（定期実行しない） */
  disabled: boolean;
  /** task.override.ts があるか */
  overridden: boolean;
  /** タスクの住所を閉じている規則の名前（開いていれば null） */
  closedBy: string | null;
};

/** 住所 → 閉じている規則の名前（開いていれば null） */
export type CronPathClosedBy = (pathname: string) => string | null;

export type LoadCronTasksOptions = {
  /** 住所の判定（呼ぶ側が渡す: scripts は門番の gate.path、テストは差し替え） */
  closedBy: CronPathClosedBy;
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

/** 空(空白とコメントだけ)の task.override.ts は不在と同じ(多段で下の Tier が親の上書きを空にしてよい、D34 K1) */
const isBlankSource = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").trim() === "";

async function loadOverride(dir: string, file: string): Promise<CronTaskOverride | null> {
  if (!existsSync(file) || isBlankSource(readFileSync(file, "utf8"))) return null;
  const label = `${CRON_ROUTE_DIR}/${dir}/${CRON_OVERRIDE_FILE}`;
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
 * 全タスクの task.ts（と、あれば task.override.ts）を読み込む。
 * task.ts が無い・`cronTask` を export していない・name がフォルダ名と違う・task.override.ts が不正・
 * 旧名の override.ts が残っている場合は throw
 * （vercel.json の生成や CLI が黙ってタスクを落とさないため）
 */
export async function loadCronTasks(repoRoot: string, options: LoadCronTasksOptions): Promise<LoadedCronTask[]> {
  const { closedBy } = options;
  const tasks: LoadedCronTask[] = [];
  for (const dir of listCronTaskDirs(repoRoot)) {
    const base = path.join(repoRoot, CRON_ROUTE_DIR, dir);
    const file = path.join(base, "task.ts");
    if (existsSync(path.join(base, LEGACY_OVERRIDE_FILE))) {
      throw new Error(
        `${CRON_ROUTE_DIR}/${dir}/${LEGACY_OVERRIDE_FILE} は旧名です。${CRON_OVERRIDE_FILE} に改名してください` +
          `（git mv ${CRON_ROUTE_DIR}/${dir}/${LEGACY_OVERRIDE_FILE} ${CRON_ROUTE_DIR}/${dir}/${CRON_OVERRIDE_FILE}。中身はそのまま）`,
      );
    }
    if (!existsSync(file)) {
      const hint = existsSync(path.join(base, CRON_OVERRIDE_FILE))
        ? `（${CRON_OVERRIDE_FILE} だけが残っている = upstream が消したタスクの上書き。${CRON_OVERRIDE_FILE} も消す）`
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
    const override = await loadOverride(dir, path.join(base, CRON_OVERRIDE_FILE));
    tasks.push({
      ...task,
      schedule: override?.schedule ?? task.schedule,
      disabled: override?.disabled === true,
      overridden: override !== null,
      closedBy: closedBy(cronTaskPath(dir)),
    });
  }
  return tasks;
}

/** 定期実行するタスク（task.override.ts で disabled にしたもの・機能が閉じているものを除く） */
export function scheduledCronTasks(tasks: readonly LoadedCronTask[]): LoadedCronTask[] {
  return tasks.filter((task) => !task.disabled && task.closedBy === null);
}
