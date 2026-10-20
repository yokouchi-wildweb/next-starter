// src/lib/cron/vercelCrons.ts
// vercel.json の crons をタスク定義から生成・検査する純関数（next / DB / fs 非依存）
//
// 利用者: scripts/cron/generate.ts（pnpm cron:generate）, scripts/cron/check.ts（pnpm cron:check / Vercel ビルド前の検査）,
//         scripts/tasks/run.ts（pnpm task --due）, scripts/cron/cronWiring.test.mjs（pnpm test:cron-wiring）
//
// vercel.json の crons は「src/app/api/cron/<name>/task.ts 1 つにつき 1 エントリ」で、人は手で書かない。
// 各エントリの時刻 = task.ts の schedule。
// - pro:   その時刻をそのまま使う
// - hobby: 1 日 1 回より細かい式だけ HOBBY_FALLBACK_SCHEDULE（名前順に STAGGER_MINUTES ずつずらす）で 1 日 1 回にする
//          （Vercel Hobby は 1 日 1 回より細かい cron でデプロイが失敗するため）

import { isAtMostDailySchedule, isValidCronExpression } from "./cronExpression";
import type { CronTaskDefinition } from "./types";

export const CRON_PLANS = ["hobby", "pro"] as const;

export type CronPlan = (typeof CRON_PLANS)[number];

export type VercelCronEntry = { path: string; schedule: string };

/** 生成・検査に必要なタスク情報（task.ts の定義の一部） */
export type CronTaskScheduleSource = Pick<CronTaskDefinition, "name" | "schedule">;

export const CRON_PATH_PREFIX = "/api/cron/";

/** Vercel Hobby で 1 日 1 回より細かいタスクを動かす時刻（19:00 UTC = 04:00 JST） */
export const HOBBY_FALLBACK_SCHEDULE = "0 19 * * *";

/** Hobby で 1 日 1 回に直すタスクを名前順にずらす間隔（分） */
export const STAGGER_MINUTES = 5;

export function isCronPlan(value: string): value is CronPlan {
  return (CRON_PLANS as readonly string[]).includes(value);
}

export function cronTaskPath(name: string): string {
  return `${CRON_PATH_PREFIX}${name}`;
}

/** task.ts の schedule の誤り（cron 式として不正）を返す */
export function validateCronSchedules(tasks: readonly CronTaskScheduleSource[]): string[] {
  return tasks
    .filter((task) => !isValidCronExpression(task.schedule))
    .map((task) => `${task.name}: task.ts の schedule "${task.schedule}" が cron 式（5 フィールド・UTC）として不正です`);
}

/** Hobby で 1 日 1 回に直されるタスク名（名前順） */
export function listHobbyDowngradedTasks(tasks: readonly CronTaskScheduleSource[]): string[] {
  return tasks
    .filter((task) => !isAtMostDailySchedule(task.schedule))
    .map((task) => task.name)
    .sort((a, b) => a.localeCompare(b));
}

/** 1 日 1 回の cron 式を offsetMinutes だけ後ろにずらす（日付をまたいだら時を 0 に戻す） */
function shiftDailySchedule(schedule: string, offsetMinutes: number): string {
  const fields = schedule.trim().split(/\s+/);
  const total = Number(fields[1]) * 60 + Number(fields[0]) + offsetMinutes;
  return [String(total % 60), String(Math.floor(total / 60) % 24), ...fields.slice(2)].join(" ");
}

/**
 * タスク定義とプランから vercel.json の crons を返す（名前順）。schedule の誤りは validateCronSchedules で先に確かめる
 */
export function buildVercelCrons(
  tasks: readonly CronTaskScheduleSource[],
  plan: CronPlan,
): VercelCronEntry[] {
  const sorted = [...tasks].sort((a, b) => a.name.localeCompare(b.name));
  let fallbackIndex = 0;
  return sorted.map((task) => {
    let schedule = task.schedule;
    if (plan === "hobby" && !isAtMostDailySchedule(schedule)) {
      schedule = shiftDailySchedule(HOBBY_FALLBACK_SCHEDULE, fallbackIndex * STAGGER_MINUTES);
      fallbackIndex += 1;
    }
    return { path: cronTaskPath(task.name), schedule };
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
 * - task.ts の schedule に誤りがあれば、まずそれを errors に出す
 * - hobby / pro どちらかの生成結果と完全一致すれば OK
 * - 一致しなければ、近い方のプラン（1 日 1 回より細かいエントリがあれば pro）との差分を errors に出す
 *   （task.ts があるのにエントリが無い = 配線漏れ、task.ts が無いのにエントリがある = 消えたタスク、時刻のずれ）
 * - /api/cron/ 以外のパス（fork 独自のエンドポイント等）は対象外
 */
export function checkVercelCrons(
  crons: unknown,
  tasks: readonly CronTaskScheduleSource[],
): VercelCronsCheckResult {
  const scheduleErrors = validateCronSchedules(tasks);
  if (scheduleErrors.length > 0) return { plan: null, errors: scheduleErrors };

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
    const expectedKeys = buildVercelCrons(tasks, plan).map(entryKey).sort();
    if (expectedKeys.length === actualKeys.length && expectedKeys.every((key, i) => key === actualKeys[i])) {
      return { plan, errors: [] };
    }
  }

  const guess: CronPlan = actual.some((entry) => !isAtMostDailySchedule(entry.schedule)) ? "pro" : "hobby";
  const expected = buildVercelCrons(tasks, guess);
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
      errors.push(`${path}: 生成結果にありません（消えたタスク、task.ts の置き忘れ、または override.ts で disabled にしたタスク）`);
    }
  }
  errors.push(`直し方: pnpm cron:generate --plan ${guess}（プランが違うなら hobby|pro を指定し直す）`);
  return { plan: null, errors };
}
