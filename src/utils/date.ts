// src/utils/date.ts

import dayjs, { isDayjs, type ConfigType } from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
// 既定ロケール "ja" をこのモジュールで読み込む（他所の副作用 import に頼るとサーバーとブラウザで曜日・月名の言語が食い違う）
import "dayjs/locale/ja";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui/ui-behavior-config";

export type FormatDateJaOptions = {
  /** Day.js へ渡す format 文字列。 */
  format?: string;
  /** フォーマットに失敗した場合の返却値。 */
  fallback?: string | null;
  /** Day.js に渡すロケール。 */
  locale?: string;
  /** 表示するタイムゾーン（IANA 名）。省略時は "Asia/Tokyo"。 */
  timeZone?: string;
};

dayjs.extend(utc);
dayjs.extend(timezone);

const DEFAULT_FORMAT = "YYYY/MM/DD";
const DEFAULT_FALLBACK = "(invalidToFormat)";
const [{ adminDataTable }] = UI_BEHAVIOR_CONFIG;
const CONFIG_FALLBACK = adminDataTable?.emptyFieldFallback;
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
    fallback = CONFIG_FALLBACK ?? DEFAULT_FALLBACK,
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
