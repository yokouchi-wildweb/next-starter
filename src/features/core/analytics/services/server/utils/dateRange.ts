// src/features/core/analytics/services/server/utils/dateRange.ts
// 日付範囲・集計粒度（Granularity）の解決ユーティリティ。
//
// 設計方針:
//  - 粒度ごとの違いは GRANULARITY_SPECS テーブルに局所化する。
//    新しい粒度を足す場合はこのテーブルに 1 エントリ追加するだけで、
//    SQL 式生成・キー文字列生成・バケット境界計算が一貫して動く。
//  - SQL 側のキー書式と JS 側のキー書式は完全に一致させる
//    （Map.get(date) のジョインに使うため）。

import { sql, type AnyColumn, type SQL } from "drizzle-orm";
import {
  DEFAULT_ANALYTICS_DAYS,
  DEFAULT_GRANULARITY,
  DEFAULT_TIMEZONE,
  MAX_GRANULARITY_PERIOD_DAYS,
} from "@/features/core/analytics/constants";
import {
  GRANULARITIES,
  type DateRangeParams,
  type Granularity,
  type ResolvedDateRange,
} from "@/features/core/analytics/types/common";
import { DomainError } from "@/lib/errors/domainError";

// ============================================================================
// 公開 API
// ============================================================================

/**
 * APIリクエストの日付範囲パラメータを解決する
 *
 * 優先順位:
 * 1. dateFrom + dateTo が両方指定 → そのまま使用
 * 2. dateFrom のみ → dateFrom ～ 今日
 * 3. dateTo のみ → dateTo から days 日遡る
 * 4. days のみ → 今日から days 日遡る
 * 5. 何も指定なし → デフォルト日数で今日から遡る
 *
 * granularity 省略時は DEFAULT_GRANULARITY（後方互換のため "day"）。
 * 期間は MAX_GRANULARITY_PERIOD_DAYS[granularity] で上限制限される。
 *
 * alignToGranularity: true の場合、dateFrom を granularity のバケット開始境界
 * （week = ISO 月曜、month = 月初）へ floor する。上限切り詰めはアライメント後に
 * 適用されるため、上限に達した場合は先頭バケットが再び不完全になることがある。
 */
export function resolveDateRange(params: DateRangeParams): ResolvedDateRange {
  const tz = params.timezone ?? DEFAULT_TIMEZONE;
  const granularity = params.granularity ?? DEFAULT_GRANULARITY;
  const maxDays = MAX_GRANULARITY_PERIOD_DAYS[granularity];
  const now = new Date();
  const today = startOfDayTz(now, tz);

  const days = Math.min(
    Math.max(params.days ?? DEFAULT_ANALYTICS_DAYS, 1),
    maxDays,
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

  // opt-in: dateFrom をバケット開始境界へ floor（期間は過去方向にのみ伸びる）
  if (params.alignToGranularity) {
    dateFrom = GRANULARITY_SPECS[granularity].truncate(dateFrom, tz);
  }

  // 上限超過時は dateFrom を引き上げて期間を切り詰める
  const dayCount = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / DAY_MS);
  if (dayCount > maxDays) {
    dateFrom = startOfDayTz(addDays(dateTo, -(maxDays - 1)), tz);
  }

  const finalDayCount = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / DAY_MS);

  return { dateFrom, dateTo, dayCount: finalDayCount, timezone: tz, granularity };
}

/**
 * 当期と同じ長さ・直前の連続期間 (= 前期) を算出する。
 *
 * 前期比較を行う全 summary 系サービスで同じ計算が必要なため共通化している。
 * 計算ロジック:
 *   prevDateFrom = range.dateFrom - dayCount 日
 *   prevDateTo   = range.dateFrom - 1ms
 *
 * 戻り値の dateFrom / dateTo は同じ ResolvedDateRange の timezone 軸上での
 * 「直前の同期間」を表す Date オブジェクト。
 */
export function derivePreviousRange(range: ResolvedDateRange): {
  dateFrom: Date;
  dateTo: Date;
} {
  const dateFrom = new Date(range.dateFrom);
  dateFrom.setDate(dateFrom.getDate() - range.dayCount);
  const dateTo = new Date(range.dateFrom);
  dateTo.setMilliseconds(dateTo.getMilliseconds() - 1);
  return { dateFrom, dateTo };
}

/**
 * URLSearchParamsからDateRangeParamsを抽出する
 */
export function parseDateRangeParams(searchParams: URLSearchParams): DateRangeParams {
  const days = searchParams.get("days");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const timezone = searchParams.get("timezone");
  const granularityParam = searchParams.get("granularity");
  const granularity = granularityParam && isGranularity(granularityParam)
    ? granularityParam
    : undefined;
  const alignParam = searchParams.get("alignToGranularity");
  const alignToGranularity = alignParam === "true" || alignParam === "1";

  return {
    ...(days && { days: Number(days) }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
    ...(timezone && { timezone }),
    ...(granularity && { granularity }),
    ...(alignToGranularity && { alignToGranularity }),
  };
}

/**
 * ResolvedDateRange のバケットキー配列を granularity に従って生成する。
 *
 * 集計クエリ結果との JOIN 用に「データのないバケットも含む」キー一覧を返す。
 * キーの書式は granularity ごとに DailyRecord["date"] の規約と一致する。
 */
export function generateDateKeys(range: ResolvedDateRange): string[] {
  const tz = range.timezone;
  const spec = GRANULARITY_SPECS[range.granularity];
  const keys: string[] = [];

  let current = spec.truncate(range.dateFrom, tz);
  const end = range.dateTo;

  while (current <= end) {
    keys.push(spec.formatKey(current, tz));
    current = spec.advance(current, tz);
  }

  return keys;
}

/**
 * Date → バケットキー文字列（タイムゾーン + granularity 指定）。
 *
 * granularity 省略時は DEFAULT_GRANULARITY（後方互換のため "day" = YYYY-MM-DD）。
 */
export function formatDateKeyTz(date: Date, timezone: string, granularity: Granularity = DEFAULT_GRANULARITY): string {
  return GRANULARITY_SPECS[granularity].formatKey(date, timezone);
}

/** Date → YYYY-MM-DD 文字列（デフォルトTZ、day 粒度） */
export function formatDateKey(date: Date): string {
  return formatDateKeyTz(date, DEFAULT_TIMEZONE);
}

/**
 * YYYY-MM-DD の日付キー + タイムゾーン → その日の開始/終了（UTC Date）を返す。
 *
 * 日次ロールアップ等、「特定の1日」を再集計する処理でバケット境界を復元する用途。
 * dateFrom = 00:00:00.000 / dateTo = 23:59:59.999（いずれも timezone 上のローカル時刻）。
 */
export function resolveDayBounds(
  dateKey: string,
  timezone: string,
): { dateFrom: Date; dateTo: Date } {
  return {
    dateFrom: tzDateToUtc(dateKey, "00:00:00.000", timezone),
    dateTo: tzDateToUtc(dateKey, "23:59:59.999", timezone),
  };
}

/**
 * ResolvedDateRange → レスポンス用文字列ペア + granularity。
 *
 * dateFrom/dateTo は粒度に関わらず YYYY-MM-DD で返す（範囲の意味的な境界表現）。
 */
export function formatDateRangeForResponse(
  range: ResolvedDateRange,
): { dateFrom: string; dateTo: string; granularity: Granularity } {
  const tz = range.timezone;
  return {
    dateFrom: GRANULARITY_SPECS.day.formatKey(range.dateFrom, tz),
    dateTo: GRANULARITY_SPECS.day.formatKey(range.dateTo, tz),
    granularity: range.granularity,
  };
}

/**
 * 集計クエリ用の SQL 式を生成する。
 *
 * 出力する文字列キーは generateDateKeys / formatDateKeyTz の出力と一致する。
 * これにより JS 側で `Map<key, row>` を組んで JOIN できる。
 *
 * 例: `granularityDateExpr(t.createdAt, "hour", "Asia/Tokyo")`
 *    → `to_char(date_trunc('hour', t.created_at AT TIME ZONE 'Asia/Tokyo'), 'YYYY-MM-DD"T"HH24":00"')`
 */
export function granularityDateExpr(
  column: AnyColumn | SQL,
  granularity: Granularity,
  timezone: string,
): SQL<string> {
  const spec = GRANULARITY_SPECS[granularity];
  // truncUnit / sqlFormatPattern は内部で定義した安全なリテラルのみ流れ込むため
  // sql.raw / リテラル埋め込みが安全。timezone のみパラメータバインド。
  return sql<string>`to_char(date_trunc(${sql.raw(`'${spec.truncUnit}'`)}, ${column} AT TIME ZONE ${timezone}), ${sql.raw(`'${spec.sqlFormatPattern}'`)})`;
}

/**
 * date 型カラム用の集計 SQL 式を生成する（granularityDateExpr の変種）。
 *
 * date 型カラムは既にタイムゾーン上のローカル日付として確定しているため、
 * AT TIME ZONE 変換を挟まず `col::timestamp` に対して date_trunc する。
 * （date に AT TIME ZONE を適用すると timestamptz へ再解釈され、
 * サーバ TZ 依存のバケット境界ズレが起きる）
 * 出力キー書式は granularityDateExpr / formatDateKeyTz と一致する。
 */
export function granularityDateExprForDateColumn(
  column: AnyColumn | SQL,
  granularity: Granularity,
): SQL<string> {
  const spec = GRANULARITY_SPECS[granularity];
  return sql<string>`to_char(date_trunc(${sql.raw(`'${spec.truncUnit}'`)}, ${column}::timestamp), ${sql.raw(`'${spec.sqlFormatPattern}'`)})`;
}

/**
 * サービスが受け入れる粒度を制約する。
 *
 * supportedGranularities に含まれない値が指定された場合は呼び出し側で
 * DomainError を投げるのに利用する（DAU など特殊なテーブル設計向け）。
 */
export function assertGranularitySupported(
  granularity: Granularity,
  supported: readonly Granularity[],
  context: string,
): void {
  if (!supported.includes(granularity)) {
    const supportedList = supported.join(", ");
    throw new GranularityNotSupportedError(
      `${context} は granularity="${granularity}" に対応していません。サポート: ${supportedList}`,
      supported,
    );
  }
}

/**
 * 未サポート粒度を伝える専用エラー。
 *
 * DomainError 派生のため API レイヤーで自動的に 400 レスポンスに変換される。
 * `supportedGranularities` を保持するので、必要なら API ハンドラ側で
 * 追加情報をレスポンスに含めることもできる。
 */
export class GranularityNotSupportedError extends DomainError {
  readonly supportedGranularities: readonly Granularity[];
  constructor(message: string, supported: readonly Granularity[]) {
    super(message, { status: 400 });
    this.name = "GranularityNotSupportedError";
    this.supportedGranularities = supported;
  }
}

// ============================================================================
// 粒度仕様テーブル
// ============================================================================

type GranularitySpec = {
  /** PostgreSQL date_trunc の単位 */
  truncUnit: "hour" | "day" | "week" | "month";
  /** PostgreSQL to_char のパターン。formatKey の出力と完全一致させる */
  sqlFormatPattern: string;
  /** Date をタイムゾーン上のバケットキー文字列に変換 */
  formatKey: (date: Date, timezone: string) => string;
  /** Date をそのバケットの開始時刻 (UTC Date) に丸める */
  truncate: (date: Date, timezone: string) => Date;
  /** バケット境界を 1 単位進める (UTC Date)。truncate された Date を入力に取る前提 */
  advance: (date: Date, timezone: string) => Date;
};

const GRANULARITY_SPECS: Record<Granularity, GranularitySpec> = {
  hour: {
    truncUnit: "hour",
    sqlFormatPattern: 'YYYY-MM-DD"T"HH24":00"',
    formatKey: (date, tz) => {
      const p = tzParts(date, tz);
      return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:00`;
    },
    truncate: (date, tz) => {
      const p = tzParts(date, tz);
      return tzDateToUtc(ymd(p.year, p.month, p.day), `${pad2(p.hour)}:00:00.000`, tz);
    },
    advance: (date, tz) => {
      const p = tzParts(date, tz);
      const d = new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour));
      d.setUTCHours(d.getUTCHours() + 1);
      return tzDateToUtc(isoYmd(d), `${pad2(d.getUTCHours())}:00:00.000`, tz);
    },
  },
  day: {
    truncUnit: "day",
    sqlFormatPattern: "YYYY-MM-DD",
    formatKey: (date, tz) => {
      const p = tzParts(date, tz);
      return ymd(p.year, p.month, p.day);
    },
    truncate: (date, tz) => {
      const p = tzParts(date, tz);
      return tzDateToUtc(ymd(p.year, p.month, p.day), "00:00:00.000", tz);
    },
    advance: (date, tz) => {
      const p = tzParts(date, tz);
      const d = new Date(Date.UTC(p.year, p.month - 1, p.day));
      d.setUTCDate(d.getUTCDate() + 1);
      return tzDateToUtc(isoYmd(d), "00:00:00.000", tz);
    },
  },
  week: {
    truncUnit: "week",
    sqlFormatPattern: "YYYY-MM-DD",
    formatKey: (date, tz) => {
      const p = tzParts(date, tz);
      const w = isoWeekStart(p.year, p.month, p.day);
      return ymd(w.year, w.month, w.day);
    },
    truncate: (date, tz) => {
      const p = tzParts(date, tz);
      const w = isoWeekStart(p.year, p.month, p.day);
      return tzDateToUtc(ymd(w.year, w.month, w.day), "00:00:00.000", tz);
    },
    advance: (date, tz) => {
      const p = tzParts(date, tz);
      const d = new Date(Date.UTC(p.year, p.month - 1, p.day));
      d.setUTCDate(d.getUTCDate() + 7);
      return tzDateToUtc(isoYmd(d), "00:00:00.000", tz);
    },
  },
  month: {
    truncUnit: "month",
    sqlFormatPattern: "YYYY-MM",
    formatKey: (date, tz) => {
      const p = tzParts(date, tz);
      return `${p.year}-${pad2(p.month)}`;
    },
    truncate: (date, tz) => {
      const p = tzParts(date, tz);
      return tzDateToUtc(ymd(p.year, p.month, 1), "00:00:00.000", tz);
    },
    advance: (date, tz) => {
      const p = tzParts(date, tz);
      const d = new Date(Date.UTC(p.year, p.month - 1, 1));
      d.setUTCMonth(d.getUTCMonth() + 1);
      return tzDateToUtc(
        ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, 1),
        "00:00:00.000",
        tz,
      );
    },
  },
};

// ============================================================================
// 内部ヘルパー
// ============================================================================

const DAY_MS = 1000 * 60 * 60 * 24;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function isoYmd(date: Date): string {
  return ymd(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function isGranularity(value: string): value is Granularity {
  return (GRANULARITIES as readonly string[]).includes(value);
}

/** 指定タイムゾーンで見た年月日時を取得 */
function tzParts(date: Date, timezone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
  };
}

/**
 * ISO 週（月曜開始）の週開始日を算出。
 * タイムゾーン非依存（日付自体の曜日のみで決まる）。
 */
function isoWeekStart(year: number, month: number, day: number): {
  year: number;
  month: number;
  day: number;
} {
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = utcDate.getUTCDay(); // 0=日, 1=月, ..., 6=土
  const daysFromMonday = (dayOfWeek + 6) % 7; // 0=月, ..., 6=日
  utcDate.setUTCDate(utcDate.getUTCDate() - daysFromMonday);
  return {
    year: utcDate.getUTCFullYear(),
    month: utcDate.getUTCMonth() + 1,
    day: utcDate.getUTCDate(),
  };
}

/**
 * 指定タイムゾーンでの日の開始（00:00:00.000）をUTC Date として返す
 */
function startOfDayTz(date: Date, timezone: string): Date {
  return GRANULARITY_SPECS.day.truncate(date, timezone);
}

/**
 * 指定タイムゾーンでの日の終了（23:59:59.999）をUTC Date として返す
 */
function endOfDayTz(date: Date, timezone: string): Date {
  const p = tzParts(date, timezone);
  return tzDateToUtc(ymd(p.year, p.month, p.day), "23:59:59.999", timezone);
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
