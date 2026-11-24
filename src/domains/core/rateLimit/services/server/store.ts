// src/domains/core/rateLimit/services/server/store.ts
// レート制限の表 rate_limits の読み書き(drizzle、D24・D57)。判定の形は ./consume.ts が決め、ここは SQL だけ。
// - 固定の窓: 1 文の INSERT … ON CONFLICT (id) DO UPDATE … WHERE(窓が過ぎた か 足しても上限の内)RETURNING。
//   行が返らない = 上限で拒否(書かない)。並んだ要求も 1 行の鍵で順に数えるので、上限を超えて通さない
// - 滑る窓: 1 つの取引(渡された tx か新しい取引)で key の xact advisory lock を取り、窓の内の bucket の count の和を数え、
//   足しても上限の内なら今の bucket の行に足す
// - 生の sql に JS の Date を入れない(toISOString を ::timestamptz で、core/services.md raw_sql)

import { and, eq, gt, ne, sql, sum, min } from "drizzle-orm";

import { db, runWithTransaction, type TransactionClient } from "@/lib/drizzle";

import { RateLimitTable } from "../../entities/drizzle";

/** 数えた結果の素の値(許可と、その時の窓の回数・窓が戻る時) */
export type RateLimitCount = { allowed: boolean; count: number; resetAt: Date };

export type FixedInput = { key: string; windowSeconds: number; limit: number; weight: number; now: Date; tx?: TransactionClient };
export type SlidingInput = FixedInput & { bucketSeconds: number };

export type RateLimitStore = {
  consumeFixed(input: FixedInput): Promise<RateLimitCount>;
  peekFixed(input: FixedInput): Promise<RateLimitCount>;
  consumeSliding(input: SlidingInput): Promise<RateLimitCount>;
  peekSliding(input: SlidingInput): Promise<RateLimitCount>;
};

type Executor = TransactionClient | typeof db;

const at = (date: Date) => sql`${date.toISOString()}::timestamptz`;
const plus = (date: Date, seconds: number) => new Date(date.getTime() + seconds * 1000);

/** 固定の窓の今の行(窓が過ぎていれば無い扱い) */
async function readFixed(run: Executor, input: FixedInput): Promise<{ count: number; resetAt: Date } | null> {
  const [row] = await run
    .select({ count: RateLimitTable.count, windowStart: RateLimitTable.window_start, expiresAt: RateLimitTable.expires_at })
    .from(RateLimitTable)
    .where(eq(RateLimitTable.id, input.key))
    .limit(1);
  if (!row || row.windowStart.getTime() <= input.now.getTime() - input.windowSeconds * 1000) return null;
  return { count: row.count, resetAt: row.expiresAt };
}

/** 滑る窓の和と、一番古い窓の内の bucket(窓が戻り始める時の元) */
async function sumSliding(run: Executor, input: SlidingInput): Promise<{ count: number; oldest: Date | null }> {
  const [row] = await run
    .select({ total: sum(RateLimitTable.count).mapWith(Number), oldest: min(RateLimitTable.window_start) })
    .from(RateLimitTable)
    .where(
      and(
        eq(RateLimitTable.key, input.key),
        ne(RateLimitTable.id, input.key),
        gt(RateLimitTable.window_start, new Date(input.now.getTime() - input.windowSeconds * 1000)),
      ),
    );
  return { count: row?.total ?? 0, oldest: row?.oldest ?? null };
}

const bucketStartOf = (now: Date, bucketSeconds: number) =>
  new Date(Math.floor(now.getTime() / (bucketSeconds * 1000)) * bucketSeconds * 1000);

export const drizzleRateLimitStore: RateLimitStore = {
  async consumeFixed(input) {
    const run: Executor = input.tx ?? db;
    if (input.weight > input.limit) {
      const current = await readFixed(run, input);
      return { allowed: false, count: current?.count ?? 0, resetAt: current?.resetAt ?? plus(input.now, input.windowSeconds) };
    }
    const expiresAt = plus(input.now, input.windowSeconds);
    const passed = sql`${RateLimitTable.window_start} <= ${at(new Date(input.now.getTime() - input.windowSeconds * 1000))}`;
    const [row] = await run
      .insert(RateLimitTable)
      .values({ id: input.key, key: input.key, count: input.weight, window_start: input.now, expires_at: expiresAt })
      .onConflictDoUpdate({
        target: RateLimitTable.id,
        set: {
          key: input.key,
          count: sql`CASE WHEN ${passed} THEN ${input.weight} ELSE ${RateLimitTable.count} + ${input.weight} END`,
          window_start: sql`CASE WHEN ${passed} THEN ${at(input.now)} ELSE ${RateLimitTable.window_start} END`,
          expires_at: sql`CASE WHEN ${passed} THEN ${at(expiresAt)} ELSE ${RateLimitTable.expires_at} END`,
        },
        setWhere: sql`${passed} OR ${RateLimitTable.count} + ${input.weight} <= ${input.limit}`,
      })
      .returning({ count: RateLimitTable.count, expiresAt: RateLimitTable.expires_at });
    if (row) return { allowed: true, count: row.count, resetAt: row.expiresAt };
    const current = await readFixed(run, input);
    return { allowed: false, count: current?.count ?? input.limit, resetAt: current?.resetAt ?? expiresAt };
  },

  async peekFixed(input) {
    const current = await readFixed(input.tx ?? db, input);
    const count = current?.count ?? 0;
    return { allowed: count + input.weight <= input.limit, count, resetAt: current?.resetAt ?? plus(input.now, input.windowSeconds) };
  },

  async consumeSliding(input) {
    return runWithTransaction(input.tx, async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.key}, 0))`);
      const { count, oldest } = await sumSliding(tx, input);
      const bucketStart = bucketStartOf(input.now, input.bucketSeconds);
      if (count + input.weight > input.limit) {
        return { allowed: false, count, resetAt: plus(oldest ?? bucketStart, input.windowSeconds) };
      }
      const expiresAt = plus(bucketStart, input.windowSeconds);
      await tx
        .insert(RateLimitTable)
        .values({
          id: `${input.key}:${Math.floor(bucketStart.getTime() / 1000)}`,
          key: input.key,
          count: input.weight,
          window_start: bucketStart,
          expires_at: expiresAt,
        })
        .onConflictDoUpdate({ target: RateLimitTable.id, set: { count: sql`${RateLimitTable.count} + ${input.weight}` } });
      return { allowed: true, count: count + input.weight, resetAt: plus(oldest ?? bucketStart, input.windowSeconds) };
    });
  },

  async peekSliding(input) {
    const { count, oldest } = await sumSliding(input.tx ?? db, input);
    return {
      allowed: count + input.weight <= input.limit,
      count,
      resetAt: plus(oldest ?? bucketStartOf(input.now, input.bucketSeconds), input.windowSeconds),
    };
  },
};
