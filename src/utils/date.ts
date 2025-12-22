// src/utils/date.ts

import dayjs, { isDayjs, type ConfigType } from "dayjs";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui/ui-behavior-config";

export type FormatDateJaOptions = {
  /** Day.js へ渡す format 文字列。 */
  format?: string;
  /** フォーマットに失敗した場合の返却値。 */
  fallback?: string | null;
  /** Day.js に渡すロケール。 */
  locale?: string;
};

const DEFAULT_FORMAT = "YYYY/MM/DD";
const DEFAULT_FALLBACK = "(invalidToFormat)";
const [{ adminDataTable }] = UI_BEHAVIOR_CONFIG;
const CONFIG_FALLBACK = adminDataTable?.emptyFieldFallback;
const DEFAULT_LOCALE = "ja";

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
 * @param date - Date/Dayjs/日付文字列など
 * @param options - フォーマット指定やフォールバックなど
 * @returns 指定されたフォーマットの文字列。フォーマットできない場合はフォールバックを返す
 */
export function formatDateJa(date: unknown, options: FormatDateJaOptions = {}): string | null {
  const {
    format = DEFAULT_FORMAT,
    fallback = CONFIG_FALLBACK ?? DEFAULT_FALLBACK,
    locale = DEFAULT_LOCALE,
  } = options;

  const input = resolveDateInput(date);
  if (input === undefined) {
    return fallback;
  }

  const parsed = dayjs(input);
  if (!parsed.isValid()) {
    return fallback;
  }

  return parsed.locale(locale).format(format);
}
