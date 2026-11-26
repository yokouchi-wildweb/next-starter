// src/domains/core/userCounter/types/domain.ts
// どの表にも属さないドメイン全体の型(entities/<登録名>/ にはその表の物だけ)

/** 個人の日別推移の 1 点 */
export type UserDailySeriesPoint = {
  /** YYYY-MM-DD（dailyTimeZone の日界） */
  date: string;
  count: number;
};
