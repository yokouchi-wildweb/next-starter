// src/lib/cron/cronExpression.ts
// 5 フィールドの cron 式（分 時 日 月 曜日、UTC）の検証と照合（純関数、依存なし）
//
// 書ける形: `*` / 数値 / 範囲 `a-b` / 間隔 `*/n`・`a-b/n` / それらのカンマ区切り。曜日は 0-7（0 と 7 = 日曜）。
// 月名・曜日名（JAN, MON 等）と `?` `L` `W` `#` は使わない（Vercel Cron も同じ範囲）。

type FieldSpec = { min: number; max: number };

const FIELDS: readonly FieldSpec[] = [
  { min: 0, max: 59 }, // 分
  { min: 0, max: 23 }, // 時
  { min: 1, max: 31 }, // 日
  { min: 1, max: 12 }, // 月
  { min: 0, max: 7 }, // 曜日
];

/** 1 フィールドが取りうる値の集合を返す。不正なら null */
function parseField(field: string, spec: FieldSpec): Set<number> | null {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const match = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part);
    if (!match) return null;
    const [, range, stepText] = match;
    const step = stepText === undefined ? 1 : Number(stepText);
    if (step < 1) return null;
    let from: number;
    let to: number;
    if (range === "*") {
      from = spec.min;
      to = spec.max;
    } else if (range.includes("-")) {
      [from, to] = range.split("-").map(Number);
    } else {
      from = Number(range);
      to = stepText === undefined ? from : spec.max;
    }
    if (from < spec.min || to > spec.max || from > to) return null;
    for (let value = from; value <= to; value += step) values.add(value);
  }
  return values;
}

function parse(expression: string): Set<number>[] | null {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const parsed = fields.map((field, i) => parseField(field, FIELDS[i]));
  return parsed.every((set): set is Set<number> => set !== null) ? parsed : null;
}

export function isValidCronExpression(expression: string): boolean {
  return parse(expression) !== null;
}

/** 「1 日 1 回以下」の cron 式か（分と時がそれぞれ 1 つの数値。日・月・曜日は自由） */
export function isAtMostDailySchedule(expression: string): boolean {
  const fields = expression.trim().split(/\s+/);
  return isValidCronExpression(expression) && /^\d+$/.test(fields[0]) && /^\d+$/.test(fields[1]);
}

/**
 * date（UTC）の「分」が cron 式に一致するか。
 * 日と曜日が両方とも `*` 以外なら、どちらか一方に一致すれば実行（標準 cron と同じ）。
 */
export function matchesCronExpression(expression: string, date: Date): boolean {
  const parsed = parse(expression);
  if (!parsed) return false;
  const [minutes, hours, days, months, weekdays] = parsed;
  const fields = expression.trim().split(/\s+/);
  const weekday = date.getUTCDay();
  const dayMatch = days.has(date.getUTCDate());
  const weekdayMatch = weekdays.has(weekday) || (weekday === 0 && weekdays.has(7));
  const dayRestricted = fields[2] !== "*";
  const weekdayRestricted = fields[4] !== "*";
  const dayOk = dayRestricted && weekdayRestricted ? dayMatch || weekdayMatch : dayMatch && weekdayMatch;
  return (
    minutes.has(date.getUTCMinutes()) && hours.has(date.getUTCHours()) && months.has(date.getUTCMonth() + 1) && dayOk
  );
}
