// src/features/core/userCounter/services/server/wrappers/bumpDaily.ts

import { sql } from "drizzle-orm";

import { USER_COUNTER_CONFIG } from "@/config/app/user-counter.config";
import { UserDailyCounterTable } from "@/features/core/userCounter/entities/drizzle";
import { db } from "@/lib/drizzle";
import type { TransactionClient } from "@/lib/drizzle/transaction";
import { DomainError } from "@/lib/errors/domainError";
import { bump } from "./bump";

export type BumpDailyOptions = {
  /** 加算量（既定 1）。整数 */
  by?: number;
  /** 日次行の保持日数。省略時は USER_COUNTER_CONFIG.defaultRetentionDays */
  retentionDays?: number;
  /** 呼び出し側トランザクションに合流させたい場合に渡す（ロールバック整合） */
  tx?: TransactionClient;
};

export type BumpDailyResult = {
  /** 加算後の累計カウント（user_counters） */
  count: number;
  /** 加算後の当日カウント（user_daily_counters） */
  dailyCount: number;
};

/**
 * per-user カウンタを「累計 + 当日」の両方へ原子的に加算する。
 *
 * 日別推移や日次制限（1日N回まで）が必要なカウンタはこちらを使う。
 * 累計だけでよいカウンタは従来どおり bump を使う。
 *
 * - 2 つの書き込みは同一トランザクションで実行し、累計と日次の整合を保つ
 *   （日次はバッチ集計ではなく発生時にその場で完成する）
 * - 日付は SQL 側で dailyTimeZone に変換して算出する（JS Date を sql に渡さない）
 * - シャーディング無し。各ユーザーは自分の行しか書かないためホット行競合は発生しない
 *
 * セキュリティ: bump と同じくサーバ内部専用。クライアントへ直接公開しないこと。
 */
export async function bumpDaily(
  userId: string,
  key: string,
  options: BumpDailyOptions = {},
): Promise<BumpDailyResult> {
  const delta = Math.trunc(options.by ?? 1);
  if (!Number.isFinite(delta)) {
    throw new DomainError("加算量は有限の整数で指定してください。", { status: 400 });
  }

  const retentionDays = options.retentionDays ?? USER_COUNTER_CONFIG.defaultRetentionDays;
  if (!Number.isInteger(retentionDays) || retentionDays <= 0) {
    throw new DomainError("保持日数は正の整数で指定してください。", { status: 400 });
  }

  const timeZone = USER_COUNTER_CONFIG.dailyTimeZone;

  const run = async (executor: TransactionClient): Promise<BumpDailyResult> => {
    const count = await bump(userId, key, delta, executor);

    const rows = await executor
      .insert(UserDailyCounterTable)
      .values({
        user_id: userId,
        counter_key: key,
        date: sql`(now() at time zone ${timeZone})::date`,
        count: delta,
        retention_days: retentionDays,
      })
      .onConflictDoUpdate({
        target: [
          UserDailyCounterTable.user_id,
          UserDailyCounterTable.counter_key,
          UserDailyCounterTable.date,
        ],
        set: {
          count: sql`${UserDailyCounterTable.count} + ${delta}`,
        },
      })
      .returning({ count: UserDailyCounterTable.count });

    const dailyCount = rows[0]?.count;
    if (dailyCount === undefined) {
      throw new DomainError("日次カウンタの更新に失敗しました。", { status: 500 });
    }
    return { count, dailyCount };
  };

  if (options.tx) {
    return await run(options.tx);
  }
  return await db.transaction(run);
}
