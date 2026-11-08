// src/utils/date.ts

import dayjs, { isDayjs, type ConfigType } from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
// 既定ロケール "ja" をこのモジュールで読み込む（他所の副作用 import に頼るとサーバーとブラウザで曜日・月名の言語が食い違う）
import "dayjs/locale/ja";

export type FormatDateJaOptions = {
  /** Day.js へ渡す format 文字列。 */
  format?: string;
  /** 値が無い・フォーマットできない場合の返却値。省略時は "(未設定)"(DEFAULT_FALLBACK)。 */
  fallback?: string | null;
  /** Day.js に渡すロケール。 */
  locale?: string;
  /** 表示するタイムゾーン（IANA 名）。省略時は "Asia/Tokyo"。 */
  timeZone?: string;
};

dayjs.extend(utc);
dayjs.extend(timezone);

const DEFAULT_FORMAT = "YYYY/MM/DD";
// 値が無い・読めないときの既定の表示。単位の部品なので設定を読まず自分の定数で持つ(設定の議会 D22 K2)。
// 管理の表など別の表示を使う呼び出しは fallback を渡す(管理の表は自分の設定の emptyFieldFallback を渡している)
export const DEFAULT_FALLBACK = "(未設定)";
const DEFAULT_LOCALE = "ja";
// 実行環境（サーバー = Vercel は UTC、ブラウザ = 利用者の端末）の時間帯に左右されないよう、既定は日本時間で固定する
const DEFAULT_TIME_ZONE = "Asia/Tokyo";
// 時刻を持たない日付だけの文字列（date 列など）。暦の日付として扱い、時間帯で日をずらさない
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function resolveDateInput(date: unknown): ConfigType | undefined {
  if (date == null) return undefined;
  if (isDayjs(date)) return date;
  if (date instanceof Date) return date;
  if (typeof date === "string" || typeof date === "number") return date;
  return undefined;
}

/**
 * 日付を日本のローカル日付文字列に変換するヘルパー
 *
 * 時刻のある値は options.timeZone（既定 "Asia/Tokyo"）の時刻で書く。サーバーとブラウザで同じ文字列になる
 * （実行環境の時間帯に従うと SSR と hydration で日付がずれる）。"YYYY-MM-DD" だけの文字列はその日付のまま書く。
 *
 * @param date - Date/Dayjs/日付文字列など
 * @param options - フォーマット指定やフォールバックなど
 * @returns 指定されたフォーマットの文字列。フォーマットできない場合はフォールバックを返す
 */
export function formatDateJa(date: unknown, options: FormatDateJaOptions = {}): string | null {
  const {
    format = DEFAULT_FORMAT,
    fallback = DEFAULT_FALLBACK,
    locale = DEFAULT_LOCALE,
    timeZone = DEFAULT_TIME_ZONE,
  } = options;

  const input = resolveDateInput(date);
  if (input === undefined) {
    return fallback;
  }

  const parsed = dayjs(input);
  if (!parsed.isValid()) {
    return fallback;
  }

  const zoned = typeof input === "string" && DATE_ONLY_PATTERN.test(input) ? parsed : parsed.tz(timeZone);
  return zoned.locale(locale).format(format);
}

export type TimeZoneOptions = {
  /** 日の境目を決めるタイムゾーン（IANA 名）。省略時は formatDateJa と同じ "Asia/Tokyo"。 */
  timeZone?: string;
};

/**
 * at を含む日の始まり（options.timeZone の 0 時。既定は日本時間）。
 * 実行環境の時間帯（サーバー = Vercel は UTC）に左右されない。「今日」の集計の境目はこれで決める
 */
export function startOfDayInTimeZone(at: ConfigType = new Date(), options: TimeZoneOptions = {}): Date {
  const { timeZone = DEFAULT_TIME_ZONE } = options;
  return dayjs(at).tz(timeZone).startOf("day").toDate();
}

/**
 * at を含む日の範囲 [start, end)（options.timeZone の 0 時から翌日の 0 時。既定は日本時間）。
 * 集計の where は createdAt >= start かつ < end で使う
 */
export function dayRangeInTimeZone(at: ConfigType = new Date(), options: TimeZoneOptions = {}): { start: Date; end: Date } {
  const { timeZone = DEFAULT_TIME_ZONE } = options;
  const start = dayjs(at).tz(timeZone).startOf("day");
  // 翌日の 0 時は「翌日のどこか」の日の始まりで取る（夏時間で 1 日が 23 / 25 時間でもずれない）
  const end = start.add(36, "hour").tz(timeZone).startOf("day");
  return { start: start.toDate(), end: end.toDate() };
}
