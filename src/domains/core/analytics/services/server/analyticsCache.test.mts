// src/domains/core/analytics/services/server/analyticsCache.test.mts
//
// 集計のキャッシュの公開の入口(analyticsCache.ts)が共有のキャッシュの標準に乗ること(DB なし)。
// next/cache は差し替える(node では指令 "use cache: remote" は効かず体がそのまま走る: 覚えることそのものは Next の中だけ)。
// - 定義: 確定済みの範囲は 12 時間、当日は 1 分の寿命とキャッシュタグ analytics・analytics:<name> を置き場に渡す、寿命の上限を超えると投げる
// - ANALYTICS_CACHE=disabled は置き場を通らない
// - invalidateAnalyticsCache(name?) はキャッシュタグを積み、入口(runWithCacheTags)の終わりに消える
// - 置き場が投げたら集計を直に計算する
// 実行: pnpm test src/domains/core/analytics/services/server/analyticsCache.test.mts
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

const seen: { life: unknown[]; tags: string[][] } = { life: [], tags: [] };
let failCache = false;
mock.module("next/cache", {
  namedExports: {
    revalidateTag: () => {},
    cacheLife: (life: unknown) => {
      if (failCache) throw new Error("remote handler down");
      seen.life.push(life);
    },
    cacheTag: (...tags: string[]) => void seen.tags.push(tags),
  },
});

const { invalidateAnalyticsCache, withAnalyticsCache } = await import("./analyticsCache.ts");
const { runWithCacheTags } = await import("@/lib/cacheTags/server");

const DAY = 24 * 60 * 60 * 1000;
const rangeEndingAt = (dateTo: Date) => ({
  dateFrom: new Date(dateTo.getTime() - DAY),
  dateTo,
  dayCount: 2,
  timezone: "Asia/Tokyo",
  granularity: "day" as const,
});

let errors: string[] = [];
beforeEach(() => {
  errors = [];
  seen.life = [];
  seen.tags = [];
  failCache = false;
  delete process.env.ANALYTICS_CACHE;
  mock.method(console, "error", (line: string) => errors.push(line));
  mock.method(console, "warn", () => {});
});
afterEach(() => mock.restoreAll());

test("withAnalyticsCache: 確定済みは 12 時間・当日は 1 分の寿命とキャッシュタグを置き場に渡し、引数を集計に渡す", async () => {
  const calls: unknown[] = [];
  const read = withAnalyticsCache("t.summary", async (_range, walletType: string) => {
    calls.push(walletType);
    return walletType.length;
  });
  assert.equal(await read(rangeEndingAt(new Date(Date.now() - 3 * DAY)), "coin"), 4);
  assert.equal(await read(rangeEndingAt(new Date()), "pt"), 2);
  assert.deepEqual(calls, ["coin", "pt"]);
  assert.deepEqual(seen.life, [
    { revalidate: 12 * 60 * 60, expire: 12 * 60 * 60 },
    { revalidate: 60, expire: 60 },
  ]);
  assert.deepEqual(seen.tags, [
    ["analytics", "analytics:t.summary"],
    ["analytics", "analytics:t.summary"],
  ]);
});

test("withAnalyticsCache: 読みごとの寿命は上限(確定済み 30 日・当日 1 時間)の中だけ", async () => {
  const read = withAnalyticsCache("t.custom", async () => 1, { closedSeconds: 3600, liveSeconds: 30 });
  await read(rangeEndingAt(new Date(Date.now() - 3 * DAY)));
  assert.deepEqual(seen.life, [{ revalidate: 3600, expire: 3600 }]);
  assert.throws(() => withAnalyticsCache("t.tooLong", async () => 1, { closedSeconds: 31 * 24 * 60 * 60 }), /closedSeconds/);
  assert.throws(() => withAnalyticsCache("t.tooLive", async () => 1, { liveSeconds: 3601 }), /liveSeconds/);
  assert.throws(() => withAnalyticsCache("", async () => 1));
});

test("withAnalyticsCache: ANALYTICS_CACHE=disabled は置き場を通らず計算する", async () => {
  const read = withAnalyticsCache("t.disabled", async () => "v");
  process.env.ANALYTICS_CACHE = "disabled";
  assert.equal(await read(rangeEndingAt(new Date())), "v");
  assert.deepEqual(seen.life, []);
});

test("withAnalyticsCache: 置き場が投げたら集計を直に計算し、記録の 1 行", async () => {
  let computed = 0;
  const read = withAnalyticsCache("t.fallback", async () => ++computed);
  failCache = true;
  assert.equal(await read(rangeEndingAt(new Date())), 1);
  assert.equal(JSON.parse(errors[0]).event, "cache read fell back to the database");
});

test("invalidateAnalyticsCache(name?): キャッシュタグを積み、入口の終わりに消える(省略 = 全集計、name = その集計)", async () => {
  const dropped: string[] = [];
  const revalidate = (tag: string) => void dropped.push(tag);
  await runWithCacheTags(async () => invalidateAnalyticsCache(), { revalidate });
  assert.deepEqual(dropped, ["analytics"]);
  dropped.length = 0;
  await runWithCacheTags(async () => invalidateAnalyticsCache("t.summary"), { revalidate });
  assert.deepEqual(dropped, ["analytics:t.summary"]);
});
