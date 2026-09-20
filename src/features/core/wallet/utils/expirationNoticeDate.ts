// src/features/core/wallet/utils/expirationNoticeDate.ts
// 失効通知の日付計算（純粋関数。タイムゾーンは Intl で解決し、外部ライブラリに依存しない）

type LocalDateParts = { year: number; month: number; day: number };

function getLocalParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
    second: pick("second"),
  };
}

/** 指定時刻における timeZone の UTC オフセット（ms） */
function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const p = getLocalParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** timeZone での「その暦日の 0:00」を表す時刻を返す（日の繰り上がりは Date.UTC が正規化する） */
function localMidnightToDate({ year, month, day }: LocalDateParts, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day);
  const first = guess - getTimeZoneOffsetMs(new Date(guess), timeZone);
  // 夏時間の切替日は推定時点と実際の 0:00 でオフセットが異なり得るため、もう一度だけ補正する
  return new Date(guess - getTimeZoneOffsetMs(new Date(first), timeZone));
}

/**
 * 「now の暦日 + days 日」の暦日の終わり（= 翌暦日の 0:00）を返す。
 *
 * 失効予告の窓の上限に使う。窓を暦日単位に揃えることで、同じ日に失効するロットが
 * 1回の通知（その日の合計額）にまとまり、cron を毎時で回しても窓が動くのは1日1回になる。
 */
export function endOfLocalDayAfter(now: Date, days: number, timeZone: string): Date {
  const p = getLocalParts(now, timeZone);
  return localMidnightToDate({ year: p.year, month: p.month, day: p.day + days + 1 }, timeZone);
}

/** timeZone での暦日を YYYY-MM-DD で返す（冪等性キー用） */
export function toLocalDateKey(date: Date, timeZone: string): string {
  const p = getLocalParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** timeZone での暦日を文面用に整形する（例: "2026年10月1日"） */
export function formatLocalDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}
