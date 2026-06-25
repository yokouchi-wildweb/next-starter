// src/features/core/userCounter/services/server/wrappers/bump.ts

import { UserCounterTable } from "@/features/core/userCounter/entities/drizzle";
import { db } from "@/lib/drizzle";
import type { TransactionClient } from "@/lib/drizzle/transaction";
import { DomainError } from "@/lib/errors/domainError";
import { sql } from "drizzle-orm";

/**
 * per-user カウンタを原子的に加算する（無ければ作成）。
 *
 * 単一文の `INSERT ... ON CONFLICT (user_id, counter_key) DO UPDATE ... RETURNING count`
 * で実装。行レベルロックのみ・read-modify-write レース無し。各ユーザは自分の行しか
 * 書かないためクロス競合は発生せず、高同時接続でも原子加算が詰まらない。
 *
 * 時刻は SQL 側の now() で発行する（JS Date を sql に直接渡さない / 原子性確保）。
 * first_occurred_at は初回 INSERT 時のみ設定され、以後の加算では更新しない。
 *
 * セキュリティ: 本メソッドはサーバ内部専用。クライアントへ直接公開しないこと
 * （カウント水増し防止）。発生イベントの正当性は呼び出し側でサーバ検証する。
 *
 * @param userId  対象ユーザ ID
 * @param key     名前空間付きカウンタキー（例: "secret_shop.dialog.<id>"）
 * @param by      加算量（既定 1）。整数。負値で減算も可能だが count の下限は保証しない
 * @param tx      省略可。呼び出し側トランザクションに合流させたい場合に渡す（ロールバック整合）
 * @returns       加算後の最新カウント
 */
export async function bump(
  userId: string,
  key: string,
  by = 1,
  tx?: TransactionClient,
): Promise<number> {
  const delta = Math.trunc(by);
  if (!Number.isFinite(delta)) {
    throw new DomainError("加算量は有限の整数で指定してください。", { status: 400 });
  }

  const executor = tx ?? db;

  const rows = await executor
    .insert(UserCounterTable)
    .values({
      user_id: userId,
      counter_key: key,
      count: delta,
      first_occurred_at: sql`now()`,
      last_occurred_at: sql`now()`,
    })
    .onConflictDoUpdate({
      target: [UserCounterTable.user_id, UserCounterTable.counter_key],
      set: {
        count: sql`${UserCounterTable.count} + ${delta}`,
        last_occurred_at: sql`now()`,
      },
    })
    .returning({ count: UserCounterTable.count });

  const newCount = rows[0]?.count;
  if (newCount === undefined) {
    throw new DomainError("カウンタの更新に失敗しました。", { status: 500 });
  }
  return newCount;
}
