// src/lib/date/parseFlexible.ts
//
// ユーザー入力の揺らぎを吸収する柔軟パーサ。
// - 日付: ISO/スラッシュ/ドット/詰め/和文の5系統を受理
// - 時刻: コロン/詰め/和文の3系統を受理
// - 日時: 日付系 × 時刻系 の組合せ（区切りは空白/T）
//
// 入力が空なら空文字を返し、パース不能なら null を返す。
// 成功時は正規化フォーマットの文字列を返すため、上位で安全に onValueChange に渡せる。

import { dayjs } from "./dayjs";

const DATE_FORMATS = [
  "YYYY-MM-DD",
  "YYYY/MM/DD",
  "YYYY.MM.DD",
  "YYYYMMDD",
  "YYYY年M月D日",
  "YYYY年MM月DD日",
] as const;

const TIME_FORMATS = [
  "HH:mm",
  "H:mm",
  "HH:mm:ss",
  "H:mm:ss",
  "HHmm",
  "H時m分",
  "HH時mm分",
] as const;

const DATETIME_SEPARATORS = [" ", "T"] as const;

const DATETIME_FORMATS: string[] = (() => {
  const formats: string[] = [];
  for (const d of DATE_FORMATS) {
    for (const t of TIME_FORMATS) {
      for (const sep of DATETIME_SEPARATORS) {
        formats.push(`${d}${sep}${t}`);
      }
    }
    // 時刻なしの日付も許容（時刻は 00:00 を補完）
    formats.push(d);
  }
  return formats;
})();

/** 空白正規化: 全角空白→半角、連続空白→単一 */
const normalizeInput = (raw: string): string =>
  raw
    .replace(/　/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const parseFlexibleDate = (raw: string): string | null => {
  const normalized = normalizeInput(raw);
  if (!normalized) return "";
  const parsed = dayjs(normalized, DATE_FORMATS as unknown as string[], true);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : null;
};

export const parseFlexibleTime = (raw: string): string | null => {
  const normalized = normalizeInput(raw);
  if (!normalized) return "";
  const parsed = dayjs(normalized, TIME_FORMATS as unknown as string[], true);
  return parsed.isValid() ? parsed.format("HH:mm") : null;
};

export const parseFlexibleDatetime = (raw: string): string | null => {
  const normalized = normalizeInput(raw);
  if (!normalized) return "";
  const parsed = dayjs(normalized, DATETIME_FORMATS, true);
  return parsed.isValid() ? parsed.format("YYYY-MM-DDTHH:mm") : null;
};
