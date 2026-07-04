// src/features/core/userCounter/services/server/wrappers/getDailyCounters.ts

import { and, asc, eq, gte, lte, sql } from "drizzle-orm";

import { USER_COUNTER_CONFIG } from "@/config/app/user-counter.config";
import { UserDailyCounterTable } from "@/features/core/userCounter/entities/drizzle";
import type { UserDailySeriesPoint } from "@/features/core/userCounter/entities/model";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors/domainError";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 当日（dailyTimeZone 基準）のカウントを取得する。行が無ければ 0。
 *
 * 日次制限（1日N回まで）の判定用。「今日」の判定はDB側で日界タイムゾーンに
 * 変換して行うため、アプリサーバのタイムゾーン設定に依存しない。
 */
export async function getTodayCount(userId: string, key: string): Promise<number> {
  const timeZone = USER_COUNTER_CONFIG.dailyTimeZone;

  const rows = await db
    .select({ count: UserDailyCounterTable.count })
    .from(UserDailyCounterTable)
    .where(
      and(
        eq(UserDailyCounterTable.user_id, userId),
        eq(UserDailyCounterTable.counter_key, key),
        eq(UserDailyCounterTable.date, sql`(now() at time zone ${timeZone})::date`),
      ),
    )
    .limit(1);

  return rows[0]?.count ?? 0;
}

export type GetDailySeriesOptions = {
  /** 取得開始日（YYYY-MM-DD, 含む）。省略時は保持期間内の全件 */
  from?: string;
  /** 取得終了日（YYYY-MM-DD, 含む）。省略時は保持期間内の全件 */
  to?: string;
};

/**
 * 個人の日別推移を取得する（活動グラフ・連続日数判定等）。
 *
 * データ源は user_daily_counters。保持期間（既定 730 日）を過ぎた日の行は
 * prune 済みのため返らない。カウントが 0 の日は行自体が無い（歯抜けになる）。
 *
 * 日付は文字列（YYYY-MM-DD）で受け渡しする
 * （JS Date を sql に渡さない規約 + タイムゾーン起因のずれ防止）。
 */
export async function getDailySeries(
  userId: string,
  key: string,
  options: GetDailySeriesOptions = {},
): Promise<UserDailySeriesPoint[]> {
  for (const bound of [options.from, options.to]) {
    if (bound !== undefined && !DATE_PATTERN.test(bound)) {
      throw new DomainError("日付は YYYY-MM-DD 形式で指定してください。", { status: 400 });
    }
  }

  const conditions = [
    eq(UserDailyCounterTable.user_id, userId),
    eq(UserDailyCounterTable.counter_key, key),
  ];
  if (options.from) conditions.push(gte(UserDailyCounterTable.date, options.from));
  if (options.to) conditions.push(lte(UserDailyCounterTable.date, options.to));

  const rows = await db
    .select({
      date: UserDailyCounterTable.date,
      count: UserDailyCounterTable.count,
    })
    .from(UserDailyCounterTable)
    .where(and(...conditions))
    .orderBy(asc(UserDailyCounterTable.date));

  return rows;
}
