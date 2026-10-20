// src/lib/cron/vercelCrons.ts
// vercel.json の crons を dispatcher 前提で生成・検査する純関数（next / DB 非依存）
//
// 利用者: scripts/cron/generate.ts（pnpm cron:generate）, scripts/cron/check.ts（pnpm cron:check / deploy:all の事前検査）,
//         src/lib/cron/cronWiring.test.mjs（pnpm test:cron-wiring）
//
// vercel.json の crons には dispatcher（/api/cron/dispatch/<cadence>）だけを置く。
// - hobby: 日次 1 本（/api/cron/dispatch/all）。Vercel Hobby は 1 日 1 回より細かい cron を拒否するため
// - pro:   頻度区分ごとに 1 本ずつ（15m / hourly / daily）
// 個別タスクのパス（/api/cron/<name>）を併記すると dispatcher と二重に走るため、検査で失敗にする。

import { CRON_CADENCES, type CronCadence, type CronDispatchCadence } from "./types";

export const CRON_PLANS = ["hobby", "pro"] as const;

export type CronPlan = (typeof CRON_PLANS)[number];

/** 頻度区分ごとの cron 式（UTC）。値は src/config/app/cron-schedule.config.ts が持つ */
export type CronScheduleConfig = Record<CronCadence, string>;

export type VercelCronEntry = { path: string; schedule: string };

export const CRON_DISPATCH_PATH_PREFIX = "/api/cron/dispatch/";

const CRON_PATH_PREFIX = "/api/cron/";

export const CRON_DISPATCH_CADENCES_BY_PLAN: Record<CronPlan, readonly CronDispatchCadence[]> = {
  hobby: ["all"],
  pro: CRON_CADENCES,
};

export function isCronPlan(value: string): value is CronPlan {
  return (CRON_PLANS as readonly string[]).includes(value);
}

export function cronDispatchPath(cadence: CronDispatchCadence): string {
  return `${CRON_DISPATCH_PATH_PREFIX}${cadence}`;
}

/** 「1 日 1 回以下」の cron 式か（分と時が固定の数値、日・月・曜日は自由） */
export function isAtMostDailySchedule(schedule: string): boolean {
  const fields = schedule.trim().split(/\s+/);
  return fields.length === 5 && /^\d+$/.test(fields[0]) && /^\d+$/.test(fields[1]);
}

/**
 * プランに応じた vercel.json の crons を返す
 */
export function buildVercelCrons(plan: CronPlan, schedules: CronScheduleConfig): VercelCronEntry[] {
  return CRON_DISPATCH_CADENCES_BY_PLAN[plan].map((cadence) => ({
    path: cronDispatchPath(cadence),
    schedule: cadence === "all" ? schedules.daily : schedules[cadence],
  }));
}

export type VercelCronsCheckResult = {
  /** dispatcher の登録がどちらのプランの形に一致したか（不一致なら null） */
  plan: CronPlan | null;
  errors: string[];
};

/**
 * vercel.json の crons が dispatcher 前提の形になっているか検査する
 *
 * - dispatcher のエントリがちょうどどちらかのプランの組になっている
 * - hobby の dispatcher は 1 日 1 回以下
 * - /api/cron/ 配下で dispatcher 以外のパスが無い（登録済みタスクなら二重実行、未登録なら配線漏れ）
 * - /api/cron/ 以外のパス（fork 独自のエンドポイント等）は対象外
 */
export function checkVercelCrons(crons: unknown): VercelCronsCheckResult {
  const errors: string[] = [];
  if (!Array.isArray(crons)) {
    return { plan: null, errors: ["crons が配列ではありません（pnpm cron:generate --plan hobby|pro で生成してください）"] };
  }

  const dispatchEntries: VercelCronEntry[] = [];
  for (const entry of crons) {
    if (!entry || typeof entry.path !== "string" || typeof entry.schedule !== "string") {
      errors.push(`crons の要素の形が不正です: ${JSON.stringify(entry)}`);
      continue;
    }
    if (entry.path.startsWith(CRON_DISPATCH_PATH_PREFIX)) {
      dispatchEntries.push(entry);
    } else if (entry.path.startsWith(CRON_PATH_PREFIX)) {
      errors.push(
        `${entry.path}: 個別タスクのエントリは置かない（dispatcher が起動するため二重実行になる）。` +
          "タスクは src/registry/cronTaskRegistry.ts（fork は forkCronTaskRegistry.ts）に登録し、" +
          "vercel.json は pnpm cron:generate で再生成する",
      );
    }
  }

  const paths = dispatchEntries.map((entry) => entry.path).sort();
  const plan =
    CRON_PLANS.find((candidate) => {
      const expected = CRON_DISPATCH_CADENCES_BY_PLAN[candidate].map(cronDispatchPath).sort();
      return expected.length === paths.length && expected.every((path, i) => path === paths[i]);
    }) ?? null;

  if (!plan) {
    errors.push(
      `dispatcher のエントリが hobby（${CRON_DISPATCH_CADENCES_BY_PLAN.hobby.map(cronDispatchPath).join(", ")}）` +
        `とも pro（${CRON_DISPATCH_CADENCES_BY_PLAN.pro.map(cronDispatchPath).join(", ")}）とも一致しません` +
        `（現在: ${paths.length > 0 ? paths.join(", ") : "なし"}）。pnpm cron:generate --plan hobby|pro で再生成してください`,
    );
  } else if (plan === "hobby") {
    for (const entry of dispatchEntries) {
      if (!isAtMostDailySchedule(entry.schedule)) {
        errors.push(`${entry.path}: Vercel Hobby は 1 日 1 回より細かい cron を受け付けません（schedule: ${entry.schedule}）`);
      }
    }
  }

  return { plan, errors };
}
