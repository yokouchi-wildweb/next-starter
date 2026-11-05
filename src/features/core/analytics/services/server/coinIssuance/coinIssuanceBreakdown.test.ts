// src/features/core/analytics/services/server/coinIssuance/coinIssuanceBreakdown.test.ts
//
// 内訳(breakdown)の検査(DB なし。ソースの一覧を差し替える)。
// - aggregator は breakdown を合計に使わない(totalIssuance / finalProfit はソースの current だけ)。応答に changeRate 付きで載る
// - toReasonKeyBreakdown: 合計 = 行の和、label = 種類の label / 未登録は key / null は「未分類」、並び = sortOrder → 未分類は最後
// 実行: pnpm test:coin-issuance
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";

mock.module("@/features/core/analytics/extensions/coinIssuanceSources", {
  namedExports: {
    coinIssuanceSources: [
      {
        key: "grant",
        kind: "issuance",
        aggregate: async () => ({
          current: 100,
          previous: 50,
          // 和が合計と食い違っても合計は current のまま(表示だけ)
          breakdown: [
            { key: "a", label: "A", current: 70, previous: 50 },
            { key: null, label: "未分類", current: 999, previous: 0 },
          ],
        }),
      },
      { key: "sales", kind: "revenue", aggregate: async () => ({ current: 300, previous: 200 }) },
    ],
  },
});

let coin: typeof import("./index");
let toReasonKeyBreakdown: typeof import("./reasonKeyBreakdown").toReasonKeyBreakdown;
before(async () => {
  coin = await import("./index");
  ({ toReasonKeyBreakdown } = await import("./reasonKeyBreakdown"));
});

test("aggregator は breakdown を合計に使わず、changeRate 付きで載せる", async () => {
  const r = await coin.getCoinIssuanceSummary({ dateFrom: "2026-10-01", dateTo: "2026-10-31" } as never);
  assert.equal(r.totalIssuance, 100);
  assert.equal(r.totalRevenue, 300);
  assert.equal(r.finalProfit, 200);
  assert.equal(r.sources.grant?.breakdown?.length, 2);
  assert.equal(r.sources.grant?.breakdown?.[0]?.changeRate !== undefined, true);
  assert.equal(r.sources.sales?.breakdown, undefined, "返さないソースは載らない");
});

test("toReasonKeyBreakdown: 合計 = 行の和、label と並び", () => {
  const items: Record<string, { key: string; label: string; category: "bonus"; sortOrder?: number }> = {
    rank_bonus: { key: "rank_bonus", label: "ランクボーナス", category: "bonus", sortOrder: 20 },
    signup_bonus: { key: "signup_bonus", label: "登録ボーナス", category: "bonus", sortOrder: 10 },
  };
  const r = toReasonKeyBreakdown(
    [
      { key: null, current: "5", previous: 1 },
      { key: "rank_bonus", current: 30, previous: "3" },
      { key: "gone_key", current: 7, previous: 0 },
      { key: "signup_bonus", current: 100, previous: 10 },
    ],
    (key) => items[key],
  );
  assert.equal(r.current, 142);
  assert.equal(r.previous, 14);
  assert.deepEqual(r.breakdown?.map((row) => [row.key, row.label]), [
    ["gone_key", "gone_key"],
    ["signup_bonus", "登録ボーナス"],
    ["rank_bonus", "ランクボーナス"],
    [null, "未分類"],
  ]);
});
