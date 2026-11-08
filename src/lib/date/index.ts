// src/lib/date/index.ts
// 日付の lib の入口(re-export だけ)。dayjs = 日本語ロケールと customParseFormat を登録済みの dayjs

export { dayjs } from "./dayjs";
export { parseFlexibleDate, parseFlexibleTime, parseFlexibleDatetime } from "./parseFlexible";
