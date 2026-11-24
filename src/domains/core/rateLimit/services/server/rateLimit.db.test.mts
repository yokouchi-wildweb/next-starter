// src/domains/core/rateLimit/services/server/rateLimit.db.test.mts
// レート制限の実 DB テスト(開発の DB の rate_limits)。書いた行は after で消す(自分の scope / identifier の行だけ)。
// DATABASE_URL が無ければ skip。列 key が無ければ失敗する(先に pnpm db:push)。
// - 固定の窓: 1 文の upsert で、並んだ要求でもちょうど limit 回だけ通る / weight / 窓が過ぎれば数え直し / peek は書かない / tx が戻れば数えも戻る
// - 滑る窓: bucket の行の和で判定、窓の外の bucket は数えない、上限は weight ごと
// - checkRateLimit / getRateLimitStatus の通す回数と戻り値は前と同じ(maxRequests − 1 回)
// 実行: pnpm test --db src/domains/core/rateLimit/services/server/rateLimit.db.test.mts
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { after, describe, test } from "node:test";

import { config as loadEnv } from "dotenv";

const envFile = resolve(process.cwd(), process.env.ENV_FILE ?? ".env.development");
if (existsSync(envFile)) loadEnv({ path: envFile, quiet: true });

const skip = (process.env.DATABASE_URL ?? "").trim().length === 0;
const RUN = randomUUID();

describe("レート制限の数え(実 DB、書いた行は消す)", { skip }, () => {
  after(async () => {
    const { db } = await import("@/lib/drizzle");
    const { like } = await import("drizzle-orm");
    const { RateLimitTable } = await import("../../entities/drizzle");
    await db.delete(RateLimitTable).where(like(RateLimitTable.id, `%${RUN}%`));
    await (db as unknown as { $client?: { end: () => Promise<void> } }).$client?.end();
  });

  test("固定の窓: 20 本を同時に数えてもちょうど limit 回だけ通る、weight、peek は書かない", async () => {
    const { consumeRateLimit, peekRateLimit } = await import("./index");
    const key = { scope: "rateLimit.test", identifier: `fixed-${RUN}` };
    const rule = { window: "fixed" as const, windowSeconds: 60, limit: 5 };
    const results = await Promise.all(Array.from({ length: 20 }, () => consumeRateLimit({ key, rule })));
    assert.equal(results.filter((r) => r.allowed).length, 5);
    const peek = await peekRateLimit({ key, rule });
    assert.deepEqual([peek.allowed, peek.count, peek.remaining], [false, 5, 0]);
    assert.equal((await peekRateLimit({ key, rule })).count, 5, "peek は書かない");
    const heavy = { scope: "rateLimit.test", identifier: `weight-${RUN}` };
    assert.equal((await consumeRateLimit({ key: heavy, rule, weight: 3 })).count, 3);
    assert.equal((await consumeRateLimit({ key: heavy, rule, weight: 3 })).allowed, false, "3 + 3 > 5");
    assert.equal((await consumeRateLimit({ key: heavy, rule, weight: 2 })).count, 5);
    assert.equal((await consumeRateLimit({ key: heavy, rule, weight: 6 })).allowed, false, "weight > limit は書かずに拒否");
  });

  test("固定の窓: 窓が過ぎれば数え直し、tx が戻れば数えも戻る", async () => {
    const { createRateLimit } = await import("./consume");
    const { drizzleRateLimitStore } = await import("./store");
    const { db } = await import("@/lib/drizzle");
    let clock = new Date();
    const rl = createRateLimit({ store: drizzleRateLimitStore, categories: {}, now: () => clock });
    const key = { scope: "rateLimit.test", identifier: `window-${RUN}` };
    const rule = { window: "fixed" as const, windowSeconds: 10, limit: 1 };
    assert.equal((await rl.consumeRateLimit({ key, rule })).allowed, true);
    assert.equal((await rl.consumeRateLimit({ key, rule })).allowed, false);
    clock = new Date(clock.getTime() + 11_000);
    const fresh = await rl.consumeRateLimit({ key, rule });
    assert.deepEqual([fresh.allowed, fresh.count], [true, 1]);
    const txKey = { scope: "rateLimit.test", identifier: `tx-${RUN}` };
    await assert.rejects(
      db.transaction(async (tx) => {
        assert.equal((await rl.consumeRateLimit({ key: txKey, rule, tx })).allowed, true);
        throw new Error("rollback");
      }),
      /rollback/,
    );
    assert.equal((await rl.peekRateLimit({ key: txKey, rule })).count, 0, "戻った取引の数えは残らない");
  });

  test("滑る窓: bucket の和で判定し、窓の外の bucket は数えない", async () => {
    const { createRateLimit } = await import("./consume");
    const { drizzleRateLimitStore } = await import("./store");
    let clock = new Date(Math.floor(Date.now() / 60_000) * 60_000 + 5_000);
    const rl = createRateLimit({ store: drizzleRateLimitStore, categories: {}, now: () => clock });
    const key = { scope: "rateLimit.test", identifier: `sliding-${RUN}` };
    const rule = { window: "sliding" as const, windowSeconds: 180, bucketSeconds: 60, limit: 10 };
    assert.equal((await rl.consumeRateLimit({ key, rule, weight: 6 })).count, 6);
    clock = new Date(clock.getTime() + 60_000);
    assert.equal((await rl.consumeRateLimit({ key, rule, weight: 5 })).allowed, false, "6 + 5 > 10(前の bucket も数える)");
    assert.equal((await rl.consumeRateLimit({ key, rule, weight: 4 })).count, 10);
    clock = new Date(clock.getTime() + 150_000);
    const later = await rl.peekRateLimit({ key, rule });
    assert.equal(later.count, 4, "最初の bucket は窓の外");
    assert.equal((await rl.consumeRateLimit({ key, rule, weight: 6 })).count, 10);
    const parallel = { scope: "rateLimit.test", identifier: `sliding-par-${RUN}` };
    const results = await Promise.all(Array.from({ length: 12 }, () => rl.consumeRateLimit({ key: parallel, rule })));
    assert.equal(results.filter((r) => r.allowed).length, 10, "同時でも鍵の lock で上限を超えない");
  });

  test("checkRateLimit / getRateLimitStatus: 通す回数と戻り値は前と同じ(maxRequests − 1 回)", async () => {
    const { checkRateLimit, getRateLimitStatus } = await import("./index");
    const { RATE_LIMIT_CONFIG } = await import("../../config");
    const category = "signupEmail" as const;
    const max = RATE_LIMIT_CONFIG[category].maxRequests;
    const identifier = `check-${RUN}`;
    assert.equal(await getRateLimitStatus(category, identifier), null);
    const results = [];
    for (let i = 0; i < max + 1; i += 1) results.push(await checkRateLimit(category, identifier));
    assert.equal(results.filter((r) => r.allowed).length, max - 1);
    assert.deepEqual([results[0].count, results[0].remaining], [1, max - 1]);
    const last = results[results.length - 1];
    assert.deepEqual([last.allowed, last.remaining, last.count], [false, 0, max - 1]);
    const status = await getRateLimitStatus(category, identifier);
    assert.deepEqual([status?.allowed, status?.count, status?.remaining], [true, max - 1, 1]);
  });
});
