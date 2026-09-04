// src/features/core/couponIssuerGrant/utils/period.ts
//
// 発行周期の解決。指定タイムゾーンの暦（日 / ISO 週 / 月）で現在時刻が属する区間を返す。
// 依存ライブラリなし（Intl.DateTimeFormat のみ）。DST を持つタイムゾーンでも
// 「ローカル 00:00 → UTC」変換をオフセット逆算で行うため端が正しく出る。

import type { IssuancePeriod, PeriodPolicy } from "@/features/core/couponIssuerGrant/types/program";

export const DEFAULT_PERIOD_TIME_ZONE = "Asia/Tokyo";

type Ymd = { year: number; month: number; day: number };

/** 指定タイムゾーンで見た年月日 */
function tzYmd(date: Date, timeZone: string): Ymd {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** ローカル日付の 00:00:00.000 を UTC Date に変換 */
function tzMidnightToUtc({ year, month, day }: Ymd, timeZone: string): Date {
  const tentative = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const local = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(tentative));
  const get = (type: string) => Number(local.find((p) => p.type === type)?.value);
  // tentative（UTC 00:00）をローカルで見た時刻 − 00:00 = オフセット（分）
  const localMinutes =
    Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute")) / 60000 -
    tentative / 60000;
  return new Date(tentative - localMinutes * 60000);
}

function addDaysYmd(ymd: Ymd, days: number): Ymd {
  const d = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function isoWeekStartYmd(ymd: Ymd): Ymd {
  const d = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day));
  const daysFromMonday = (d.getUTCDay() + 6) % 7;
  return addDaysYmd(ymd, -daysFromMonday);
}

function formatYmd({ year, month, day }: Ymd): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 現在時刻が属する発行周期を解決する。
 * - kind: "none" → null（周期なし = ユーザーにつき 1 枚）
 * - kind: "custom" → resolve(now) の結果（null = 発行期間外）
 */
export function resolveIssuancePeriod(policy: PeriodPolicy, now: Date = new Date()): IssuancePeriod | null {
  if (policy.kind === "none") return null;
  if (policy.kind === "custom") return policy.resolve(now);

  const timeZone = policy.timeZone ?? DEFAULT_PERIOD_TIME_ZONE;
  const today = tzYmd(now, timeZone);

  let startYmd: Ymd;
  let endYmd: Ymd;
  switch (policy.kind) {
    case "calendar_day":
      startYmd = today;
      endYmd = addDaysYmd(today, 1);
      break;
    case "calendar_week":
      startYmd = isoWeekStartYmd(today);
      endYmd = addDaysYmd(startYmd, 7);
      break;
    case "calendar_month":
      startYmd = { year: today.year, month: today.month, day: 1 };
      endYmd = today.month === 12
        ? { year: today.year + 1, month: 1, day: 1 }
        : { year: today.year, month: today.month + 1, day: 1 };
      break;
  }

  return {
    key: formatYmd(startYmd),
    start: tzMidnightToUtc(startYmd, timeZone),
    end: tzMidnightToUtc(endYmd, timeZone),
  };
}
