// src/lib/date/value.ts
// 日付らしい値(string / number / Date / dayjs)を dayjs にする決まりと、それを書式にする補助(1 つだけ)。
// 読めない値をどう見せるか(入力の値・表の表示・fallback 付きの表示)は呼ぶ側が決める

import { isDayjs, type Dayjs } from "dayjs";
import { dayjs } from "./dayjs";

/**
 * 日付らしい値を dayjs にする。文字列は前後の空白を削る。
 * null・undefined・空文字・それ以外の型・読めない値は null
 */
export function toDayjs(value: unknown): Dayjs | null {
  let input: string | number | Date | Dayjs;
  if (typeof value === "string") {
    input = value.trim();
    if (!input) return null;
  } else if (typeof value === "number" || value instanceof Date || isDayjs(value)) {
    input = value;
  } else {
    return null;
  }
  const parsed = dayjs(input);
  return parsed.isValid() ? parsed : null;
}

/** 日付らしい値を pattern(dayjs の書式)で書く。日付として読めなければ null */
export function formatDateLike(value: unknown, pattern: string): string | null {
  return toDayjs(value)?.format(pattern) ?? null;
}
