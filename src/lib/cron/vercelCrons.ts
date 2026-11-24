// src/lib/cron/vercelCrons.ts
// vercel.json の crons をタスク定義から生成・検査する純関数（next / DB / fs 非依存）
// 検査は repo.json の vercel.plan（宣言、呼び手が readVercelPlan で読んで渡す）と照らし、crons と schedules の二重登録も止める
// 宣言が無いときのプランの読み方は inferCronPlan の 1 つだけ（検査と生成器が共有する）
//
// 利用者: scripts/structure/cron/generate.ts（pnpm generate cron）, scripts/structure/cron/check.ts（pnpm check cron / Vercel ビルド前の検査）,
//         scripts/runner/task/run.ts（pnpm task --due）, scripts/structure/cron/cronWiring.test.mjs（pnpm test scripts/structure/cron/cronWiring.test.mjs）
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
  /** crons が一致したプラン（不一致なら null） */
  plan: CronPlan | null;
  errors: string[];
};

const entryKey = (entry: VercelCronEntry) => `${entry.path} ${entry.schedule}`;

function matchesPlan(actualKeys: readonly string[], tasks: readonly CronTaskScheduleSource[], plan: CronPlan): boolean {
  const expectedKeys = buildVercelCrons(tasks, plan).map(entryKey).sort();
  return expectedKeys.length === actualKeys.length && expectedKeys.every((key, i) => key === actualKeys[i]);
}

/** crons のうち /api/cron/ 配下で形の正しいエントリ */
function cronTaskEntries(crons: unknown): VercelCronEntry[] {
  if (!Array.isArray(crons)) return [];
  return crons
    .filter(
      (entry): entry is VercelCronEntry =>
        !!entry && typeof entry.path === "string" && typeof entry.schedule === "string" && entry.path.startsWith(CRON_PATH_PREFIX),
    )
    .map((entry) => ({ path: entry.path, schedule: entry.schedule }));
}

/**
 * repo.json に vercel.plan が無いとき、今の vercel.json の crons からプランを読む（検査と生成器の共通の読み方）
 *
 * - どちらかのプランの生成結果と完全一致すればそのプラン（両方と一致する = 違いの無いときは hobby）
 * - 一致しなければ、/api/cron/ 配下に 1 日 1 回より細かいエントリがあれば pro、無ければ hobby
 *   （全部 1 日 1 回の crons に細かいタスクが増えると hobby と読む。宣言すれば迷わない）
 * - /api/cron/ 以外のエントリと形の崩れたエントリは見ない
 */
export function inferCronPlan(crons: unknown, tasks: readonly CronTaskScheduleSource[]): CronPlan {
  const actual = cronTaskEntries(crons);
  const actualKeys = actual.map(entryKey).sort();
  for (const plan of CRON_PLANS) {
    if (matchesPlan(actualKeys, tasks, plan)) return plan;
  }
  return actual.some((entry) => !isAtMostDailySchedule(entry.schedule)) ? "pro" : "hobby";
}

/**
 * vercel.json の crons（/api/cron/ 配下）が、今のタスク定義からの生成結果と一致するか検査する
 *
 * - task.ts の schedule に誤りがあれば、まずそれを errors に出す
 * - declaredPlan = repo.json の vercel.plan（readVercelPlan）
 *   - 宣言あり: そのプランの生成結果と完全一致すれば OK。もう一方のプランの生成結果と一致していたら、宣言との食い違いとして失敗
 *   - 宣言なし（null）: hobby / pro どちらかの生成結果と完全一致すれば OK（警告は呼び手が出す）
 * - 一致しなければ、比べるプラン（宣言、無ければ inferCronPlan）との差分を errors に出す
 *   （task.ts があるのにエントリが無い = 配線漏れ、task.ts が無いのにエントリがある = 消えたタスク、時刻のずれ）
 * - /api/cron/ 以外のパス（fork 独自のエンドポイント等）は対象外
 */
export function checkVercelCrons(
  crons: unknown,
  tasks: readonly CronTaskScheduleSource[],
  declaredPlan: CronPlan | null,
): VercelCronsCheckResult {
  const scheduleErrors = validateCronSchedules(tasks);
  if (scheduleErrors.length > 0) return { plan: null, errors: scheduleErrors };

  if (!Array.isArray(crons)) {
    return { plan: null, errors: ["crons が配列ではありません（pnpm generate cron -- --plan hobby|pro で生成してください）"] };
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
  if (declaredPlan) {
    if (matchesPlan(actualKeys, tasks, declaredPlan)) return { plan: declaredPlan, errors: [] };
    const other: CronPlan = declaredPlan === "pro" ? "hobby" : "pro";
    if (matchesPlan(actualKeys, tasks, other)) {
      return {
        plan: null,
        errors: [
          `crons は ${other} の生成結果ですが、repo.json の vercel.plan は ${declaredPlan} です` +
            `（直し方: pnpm generate cron -- --plan ${declaredPlan}。プランが ${other} なら pnpm workflow repo-json set vercel.plan ${other}）`,
        ],
      };
    }
  }
  const guess: CronPlan = declaredPlan ?? inferCronPlan(actual, tasks);
  if (!declaredPlan && matchesPlan(actualKeys, tasks, guess)) return { plan: guess, errors: [] };

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
      errors.push(`${path}: 生成結果にありません（消えたタスク、task.ts の置き忘れ、または task.override.ts で disabled にしたタスク）`);
    }
  }
  errors.push(
    declaredPlan
      ? `直し方: pnpm generate cron -- --plan ${declaredPlan}（repo.json の vercel.plan）`
      : `直し方: pnpm generate cron -- --plan ${guess}（プランが違うなら hobby|pro を指定し直す）`,
  );
  return { plan: null, errors };
}

/**
 * vercel.json の crons と schedules に同じ /api/cron/ のパスが載っていないか検査する（載っていれば二重実行になる）
 *
 * - schedules = 名前をキーにした object、値は { schedule, path | function, requestMethod? }
 * - schedules が無い・object でない、path を持たない値、/api/cron/ 以外のパスは対象外
 */
export function findCronScheduleOverlaps(crons: unknown, schedules: unknown): string[] {
  if (!Array.isArray(crons) || !schedules || typeof schedules !== "object" || Array.isArray(schedules)) return [];
  const cronPaths = new Set(
    crons
      .map((entry) => (entry && typeof entry.path === "string" ? entry.path : null))
      .filter((path): path is string => path !== null && path.startsWith(CRON_PATH_PREFIX)),
  );
  const errors: string[] = [];
  for (const [name, value] of Object.entries(schedules as Record<string, unknown>)) {
    const path = value && typeof value === "object" ? (value as { path?: unknown }).path : undefined;
    if (typeof path === "string" && cronPaths.has(path)) {
      errors.push(`${path}: crons と schedules.${name} の両方に載っています（二重実行になる。cron タスクは crons だけに置く）`);
    }
  }
  return errors;
}
