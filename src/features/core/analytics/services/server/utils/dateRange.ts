// src/features/core/analytics/services/server/utils/dateRange.ts
// 日付範囲パラメータの解決ユーティリティ

import { DEFAULT_ANALYTICS_DAYS, MAX_ANALYTICS_DAYS } from "@/features/core/analytics/constants";
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
  const now = new Date();
  const today = startOfDay(now);

  const days = Math.min(
    Math.max(params.days ?? DEFAULT_ANALYTICS_DAYS, 1),
    MAX_ANALYTICS_DAYS,
  );

  let dateFrom: Date;
  let dateTo: Date;

  if (params.dateFrom && params.dateTo) {
    dateFrom = startOfDay(new Date(params.dateFrom));
    dateTo = endOfDay(new Date(params.dateTo));
  } else if (params.dateFrom) {
    dateFrom = startOfDay(new Date(params.dateFrom));
    dateTo = endOfDay(today);
  } else if (params.dateTo) {
    dateTo = endOfDay(new Date(params.dateTo));
    dateFrom = startOfDay(addDays(dateTo, -(days - 1)));
  } else {
    dateTo = endOfDay(today);
    dateFrom = startOfDay(addDays(today, -(days - 1)));
  }

  // 不正な範囲の場合はdateFromを強制調整
  if (dateFrom > dateTo) {
    dateFrom = startOfDay(dateTo);
  }

  const dayCount = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24));

  return { dateFrom, dateTo, dayCount };
}

/**
 * URLSearchParamsからDateRangeParamsを抽出する
 */
export function parseDateRangeParams(searchParams: URLSearchParams): DateRangeParams {
  const days = searchParams.get("days");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  return {
    ...(days && { days: Number(days) }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
  };
}

/**
 * ResolvedDateRange内の全日付をYYYY-MM-DD配列として生成
 * 日別集計で「データのない日もレコードに含める」場合に使用
 */
export function generateDateKeys(range: ResolvedDateRange): string[] {
  const keys: string[] = [];
  const current = new Date(range.dateFrom);
  const end = range.dateTo;

  while (current <= end) {
    keys.push(formatDateKey(current));
    current.setDate(current.getDate() + 1);
  }

  return keys;
}

/** Date → YYYY-MM-DD 文字列 */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** ResolvedDateRange → レスポンス用文字列ペア */
export function formatDateRangeForResponse(range: ResolvedDateRange): { dateFrom: string; dateTo: string } {
  return {
    dateFrom: formatDateKey(range.dateFrom),
    dateTo: formatDateKey(range.dateTo),
  };
}

// ============================================================================
// 内部ヘルパー
// ============================================================================

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
