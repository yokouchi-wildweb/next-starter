// src/features/core/analytics/services/server/utils/dateRange.ts
// 日付範囲パラメータの解決ユーティリティ（タイムゾーン対応）

import { DEFAULT_ANALYTICS_DAYS, MAX_ANALYTICS_DAYS, DEFAULT_TIMEZONE } from "@/features/core/analytics/constants";
import type { DateRangeParams, ResolvedDateRange } from "@/features/core/analytics/types/common";

/**
 * APIリクエストの日付範囲パラメータを解決する
 *
 * 優先順位:
 * 1. dateFrom + dateTo が両方指定 → そのまま使用
 * 2. dateFrom のみ → dateFrom ～ 今日
 * 3. dateTo のみ → dateTo から days 日遡る
 * 4. days のみ → 今日から days 日遡る
 * 5. 何も指定なし → デフォルト日数で今日から遡る
 */
export function resolveDateRange(params: DateRangeParams): ResolvedDateRange {
  const tz = params.timezone ?? DEFAULT_TIMEZONE;
  const now = new Date();
  const today = startOfDayTz(now, tz);

  const days = Math.min(
    Math.max(params.days ?? DEFAULT_ANALYTICS_DAYS, 1),
    MAX_ANALYTICS_DAYS,
  );

  let dateFrom: Date;
  let dateTo: Date;

  if (params.dateFrom && params.dateTo) {
    dateFrom = startOfDayTz(new Date(params.dateFrom), tz);
    dateTo = endOfDayTz(new Date(params.dateTo), tz);
  } else if (params.dateFrom) {
    dateFrom = startOfDayTz(new Date(params.dateFrom), tz);
    dateTo = endOfDayTz(today, tz);
  } else if (params.dateTo) {
    dateTo = endOfDayTz(new Date(params.dateTo), tz);
    dateFrom = startOfDayTz(addDays(dateTo, -(days - 1)), tz);
  } else {
    dateTo = endOfDayTz(today, tz);
    dateFrom = startOfDayTz(addDays(today, -(days - 1)), tz);
  }

  // 不正な範囲の場合はdateFromを強制調整
  if (dateFrom > dateTo) {
    dateFrom = startOfDayTz(dateTo, tz);
  }

  const dayCount = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24));

  return { dateFrom, dateTo, dayCount, timezone: tz };
}

/**
 * URLSearchParamsからDateRangeParamsを抽出する
 */
export function parseDateRangeParams(searchParams: URLSearchParams): DateRangeParams {
  const days = searchParams.get("days");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const timezone = searchParams.get("timezone");

  return {
    ...(days && { days: Number(days) }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
    ...(timezone && { timezone }),
  };
}

/**
 * ResolvedDateRange内の全日付をYYYY-MM-DD配列として生成
 * 日別集計で「データのない日もレコードに含める」場合に使用
 */
export function generateDateKeys(range: ResolvedDateRange): string[] {
  const tz = range.timezone ?? DEFAULT_TIMEZONE;
  const keys: string[] = [];
  const current = new Date(range.dateFrom);
  const end = range.dateTo;

  while (current <= end) {
    keys.push(formatDateKeyTz(current, tz));
    current.setDate(current.getDate() + 1);
  }

  return keys;
}

/**
 * Date → YYYY-MM-DD 文字列（タイムゾーン指定）
 */
export function formatDateKeyTz(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

/** Date → YYYY-MM-DD 文字列（デフォルトTZ） */
export function formatDateKey(date: Date): string {
  return formatDateKeyTz(date, DEFAULT_TIMEZONE);
}

/** ResolvedDateRange → レスポンス用文字列ペア */
export function formatDateRangeForResponse(range: ResolvedDateRange): { dateFrom: string; dateTo: string } {
  const tz = range.timezone ?? DEFAULT_TIMEZONE;
  return {
    dateFrom: formatDateKeyTz(range.dateFrom, tz),
    dateTo: formatDateKeyTz(range.dateTo, tz),
  };
}

// ============================================================================
// タイムゾーン対応の日付ヘルパー
// ============================================================================

/**
 * 指定タイムゾーンでの日の開始（00:00:00.000）をUTC Date として返す
 */
function startOfDayTz(date: Date, timezone: string): Date {
  const localDateStr = formatDateKeyTz(date, timezone);
  return tzDateToUtc(localDateStr, "00:00:00.000", timezone);
}

/**
 * 指定タイムゾーンでの日の終了（23:59:59.999）をUTC Date として返す
 */
function endOfDayTz(date: Date, timezone: string): Date {
  const localDateStr = formatDateKeyTz(date, timezone);
  return tzDateToUtc(localDateStr, "23:59:59.999", timezone);
}

/**
 * ローカル日付文字列 + 時刻 + タイムゾーン → UTC Date
 *
 * Intl.DateTimeFormat でタイムゾーンの UTC オフセットを算出し、
 * ローカル時刻からUTCミリ秒を逆算する
 */
function tzDateToUtc(dateStr: string, timeStr: string, timezone: string): Date {
  // dateStr: "YYYY-MM-DD", timeStr: "HH:mm:ss.SSS"
  const [year, month, day] = dateStr.split("-").map(Number) as [number, number, number];
  const [timePart, msPart] = timeStr.split(".");
  const [hours, minutes, seconds] = timePart!.split(":").map(Number) as [number, number, number];
  const ms = msPart ? Number(msPart) : 0;

  // 仮のUTC Dateを作成
  const tentativeUtc = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, ms));

  // このUTC時刻がtimezoneで何時かを取得してオフセットを計算
  const localParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(tentativeUtc);

  const localHour = Number(localParts.find((p) => p.type === "hour")!.value);
  const localMinute = Number(localParts.find((p) => p.type === "minute")!.value);

  // オフセット = ローカル時刻 - UTC時刻（分単位）
  let offsetMinutes = (localHour * 60 + localMinute) - (hours * 60 + minutes);

  // 日付をまたぐ場合の補正（±12時間以内）
  if (offsetMinutes > 720) offsetMinutes -= 1440;
  if (offsetMinutes < -720) offsetMinutes += 1440;

  // 目標: ローカル時刻 = hours:minutes なので、UTC = ローカル - offset
  return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, ms) - offsetMinutes * 60 * 1000);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
