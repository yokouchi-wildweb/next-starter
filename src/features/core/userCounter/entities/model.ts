// src/features/core/userCounter/entities/model.ts

export type UserCounter = {
  id: string;
  user_id: string;
  counter_key: string;
  count: number;
  first_occurred_at: Date;
  last_occurred_at: Date;
};

export type UserDailyCounter = {
  id: string;
  user_id: string;
  counter_key: string;
  /** YYYY-MM-DD（dailyTimeZone の日界） */
  date: string;
  count: number;
  retention_days: number;
};

/** 個人の日別推移の 1 点 */
export type UserDailySeriesPoint = {
  /** YYYY-MM-DD（dailyTimeZone の日界） */
  date: string;
  count: number;
};
