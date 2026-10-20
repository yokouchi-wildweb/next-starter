// src/lib/cron/vercelCrons.ts
// vercel.json の crons をタスク定義から生成・検査する純関数（next / DB / fs 非依存）
//
// 利用者: scripts/cron/generate.ts（pnpm cron:generate）, scripts/cron/check.ts（pnpm cron:check / Vercel ビルド前の検査）,
//         scripts/cron/cronWiring.test.mjs（pnpm test:cron-wiring）
//
// vercel.json の crons は「src/app/api/cron/<name>/task.ts 1 つにつき 1 エントリ」で、人は手で書かない。
// - pro:   task.ts の cadence に従う（15m / hourly / daily）
// - hobby: 全タスクを 1 日 1 回にする（Vercel Hobby は 1 日 1 回より細かい cron でデプロイが失敗するため）
// 同じ時刻に集中しないよう、毎時・毎日のタスクは名前順に STAGGER_MINUTES ずつずらす。

import type { CronCadence, CronTaskDefinition } from "./types";

export const CRON_PLANS = ["hobby", "pro"] as const;

export type CronPlan = (typeof CRON_PLANS)[number];

/** 頻度区分ごとの基準の cron 式（UTC）。値は src/config/app/cron-schedule.config.ts が持つ */
export type CronScheduleConfig = Record<CronCadence, string>;

export type VercelCronEntry = { path: string; schedule: string };

/** 生成・検査に必要なタスク情報（task.ts の定義の一部） */
export type CronTaskScheduleSource = Pick<CronTaskDefinition, "name" | "cadence">;

export const CRON_PATH_PREFIX = "/api/cron/";

/** 毎時・毎日のタスクを名前順にずらす間隔（分） */
export const STAGGER_MINUTES = 5;

export function isCronPlan(value: string): value is CronPlan {
  return (CRON_PLANS as readonly string[]).includes(value);
}

export function cronTaskPath(name: string): string {
  return `${CRON_PATH_PREFIX}${name}`;
}

/** 「1 日 1 回以下」の cron 式か（分と時が固定の数値、日・月・曜日は自由） */
export function isAtMostDailySchedule(schedule: string): boolean {
  const fields = schedule.trim().split(/\s+/);
  return fields.length === 5 && /^\d+$/.test(fields[0]) && /^\d+$/.test(fields[1]);
}

/**
 * 基準の cron 式を offsetMinutes だけ後ろにずらす。
 * 毎時（"M * * * *"）は分だけ、1 日 1 回以下（"M H ..."）は時分をずらす。それ以外の形はそのまま返す。
 */
function shiftSchedule(cadence: CronCadence, base: string, offsetMinutes: number): string {
  if (offsetMinutes === 0 || cadence === "15m") return base;
  const fields = base.trim().split(/\s+/);
  if (fields.length !== 5 || !/^\d+$/.test(fields[0])) return base;
  const minute = Number(fields[0]);
  if (fields[1] === "*") {
    return [String((minute + offsetMinutes) % 60), ...fields.slice(1)].join(" ");
  }
  if (!/^\d+$/.test(fields[1])) return base;
  const total = Number(fields[1]) * 60 + minute + offsetMinutes;
  return [String(total % 60), String(Math.floor(total / 60) % 24), ...fields.slice(2)].join(" ");
}

/**
 * タスク定義とプランから vercel.json の crons を返す（名前順）
 */
export function buildVercelCrons(
  tasks: readonly CronTaskScheduleSource[],
  plan: CronPlan,
  schedules: CronScheduleConfig,
): VercelCronEntry[] {
  const sorted = [...tasks].sort((a, b) => a.name.localeCompare(b.name));
  const indexByCadence: Partial<Record<CronCadence, number>> = {};
  return sorted.map((task) => {
    const cadence: CronCadence = plan === "hobby" ? "daily" : task.cadence;
    const index = indexByCadence[cadence] ?? 0;
    indexByCadence[cadence] = index + 1;
    return {
      path: cronTaskPath(task.name),
      schedule: shiftSchedule(cadence, schedules[cadence], index * STAGGER_MINUTES),
    };
  });
}

export type VercelCronsCheckResult = {
  /** crons がどちらのプランの生成結果と一致したか（不一致なら null） */
  plan: CronPlan | null;
  errors: string[];
};

const entryKey = (entry: VercelCronEntry) => `${entry.path} ${entry.schedule}`;

/**
 * vercel.json の crons（/api/cron/ 配下）が、今のタスク定義からの生成結果と一致するか検査する
 *
 * - hobby / pro どちらかの生成結果と完全一致すれば OK
 * - 一致しなければ、近い方のプラン（1 日 1 回より細かいエントリがあれば pro）との差分を errors に出す
 *   （task.ts があるのにエントリが無い = 配線漏れ、task.ts が無いのにエントリがある = 消えたタスク、時刻のずれ）
 * - /api/cron/ 以外のパス（fork 独自のエンドポイント等）は対象外
 */
export function checkVercelCrons(
  crons: unknown,
  tasks: readonly CronTaskScheduleSource[],
  schedules: CronScheduleConfig,
): VercelCronsCheckResult {
  if (!Array.isArray(crons)) {
    return { plan: null, errors: ["crons が配列ではありません（pnpm cron:generate --plan hobby|pro で生成してください）"] };
  }

  const errors: string[] = [];
  const actual: VercelCronEntry[] = [];
  for (const entry of crons) {
    if (!entry || typeof entry.path !== "string" || typeof entry.schedule !== "string") {
      errors.push(`crons の要素の形が不正です: ${JSON.stringify(entry)}`);
      continue;
    }
    if (entry.path.startsWith(CRON_PATH_PREFIX)) actual.push({ path: entry.path, schedule: entry.schedule });
  }
  if (errors.length > 0) return { plan: null, errors };

  const actualKeys = actual.map(entryKey).sort();
  for (const plan of CRON_PLANS) {
    const expectedKeys = buildVercelCrons(tasks, plan, schedules).map(entryKey).sort();
    if (expectedKeys.length === actualKeys.length && expectedKeys.every((key, i) => key === actualKeys[i])) {
      return { plan, errors: [] };
    }
  }

  const guess: CronPlan = actual.some((entry) => !isAtMostDailySchedule(entry.schedule)) ? "pro" : "hobby";
  const expected = buildVercelCrons(tasks, guess, schedules);
  const actualByPath = new Map<string, VercelCronEntry[]>();
  for (const entry of actual) actualByPath.set(entry.path, [...(actualByPath.get(entry.path) ?? []), entry]);

  for (const entry of expected) {
    const found = actualByPath.get(entry.path);
    if (!found) {
      errors.push(`${entry.path}: エントリがありません（タスクがあるのに本番で動かない）`);
    } else if (found.length > 1) {
      errors.push(`${entry.path}: エントリが重複しています（二重実行になる）`);
    } else if (found[0].schedule !== entry.schedule) {
      errors.push(`${entry.path}: schedule が "${found[0].schedule}" です（生成結果は "${entry.schedule}"）`);
    }
  }
  const expectedPaths = new Set(expected.map((entry) => entry.path));
  for (const path of actualByPath.keys()) {
    if (!expectedPaths.has(path)) {
      errors.push(`${path}: 対応する src/app/api/cron/<name>/task.ts がありません（消えたタスク、または task.ts の置き忘れ）`);
    }
  }
  errors.push(`直し方: pnpm cron:generate --plan ${guess}（プランが違うなら hobby|pro を指定し直す）`);
  return { plan: null, errors };
}
