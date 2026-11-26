// src/domains/core/userCounter/entities/userDailyCounter/model.ts

export type UserDailyCounter = {
  id: string;
  user_id: string;
  counter_key: string;
  /** YYYY-MM-DD（dailyTimeZone の日界） */
  date: string;
  count: number;
  retention_days: number;
};
