// マイルストーンの読み手の検査(受け口の一覧は偽物)。
// - 普通の定義だけ: 今と同じ一覧(そのままの定義、series の印なし)
// - シリーズ: 段階ごとの定義へ展開(鍵 = stageKey、印、項目の順 → stages の順、evaluate / onAchieved に段階が渡る)
// - stages は呼ぶたびに読み直す(段階を足す・消すと次の呼び出しで変わる)
// - 鍵の重複は例外(普通どうし・段階どうし・シリーズをまたぐ・普通と段階・シリーズの鍵と他)、空の stageKey も例外
// 実行: pnpm test src/features/core/milestone/services/server/milestoneRegistry.test.ts
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";

import type { MilestoneDefinition, MilestoneItem, MilestoneSeries } from "../../types/milestone";

const items: MilestoneItem[] = [];
mock.module("@/features/core/milestone/extensions/definitions", { namedExports: { definitions: items } });

let registry: typeof import("./milestoneRegistry");
let defineMilestoneSeries: typeof import("../../types/milestone").defineMilestoneSeries;
before(async () => {
  registry = await import("./milestoneRegistry");
  ({ defineMilestoneSeries } = await import("../../types/milestone"));
});
beforeEach(() => {
  items.length = 0;
});

const plain = (key: string, triggers = ["purchase_completed"]): MilestoneDefinition => ({
  key,
  triggers,
  evaluate: async () => true,
});

type Tier = { key: string; threshold: number };
let tiers: Tier[] = [];
const calls: { fn: string; stage: string }[] = [];
const rankSeries = (): MilestoneSeries<Tier> =>
  defineMilestoneSeries<Tier>({
    kind: "series",
    key: "rank_up",
    triggers: ["purchase_completed"],
    order: "sequential",
    stages: () => tiers,
    stageKey: (tier) => `rank_${tier.key}`,
    evaluate: async (tier, context) => {
      calls.push({ fn: "evaluate", stage: tier.key });
      return Number(context.payload.total) >= tier.threshold;
    },
    onAchieved: async (tier) => {
      calls.push({ fn: "onAchieved", stage: tier.key });
      return { tier: tier.key };
    },
  });

test("普通の定義だけ: 今と同じ一覧(同じ定義、印なし)", () => {
  const a = plain("first_purchase");
  const b = plain("signup_bonus", ["user_registered"]);
  items.push(a, b);
  assert.deepEqual(registry.getAllMilestones(), [a, b]);
  assert.equal(registry.getMilestoneByKey("first_purchase"), a);
  assert.deepEqual(registry.getMilestonesByTrigger("user_registered"), [b]);
  assert.equal(registry.getAllMilestones()[0].series, undefined);
});

test("シリーズ: 段階ごとに展開し、鍵・印・並び・段階の受け渡しを持つ", async () => {
  tiers = [
    { key: "bronze", threshold: 3000 },
    { key: "silver", threshold: 10000 },
  ];
  calls.length = 0;
  items.push(plain("first_purchase"), rankSeries(), plain("total_5000"));
  const all = registry.getAllMilestones();
  assert.deepEqual(
    all.map((d) => d.key),
    ["first_purchase", "rank_bronze", "rank_silver", "total_5000"],
  );
  assert.deepEqual(all[2].series, { seriesKey: "rank_up", stageKey: "rank_silver", index: 1, order: "sequential" });
  assert.deepEqual(all[1].triggers, ["purchase_completed"]);

  const context = { userId: "u1", trigger: "purchase_completed", payload: { total: 5000 } };
  assert.equal(await all[1].evaluate(context), true);
  assert.equal(await all[2].evaluate(context), false);
  assert.deepEqual(await all[1].onAchieved?.({ userId: "u1", milestoneKey: "rank_bronze", context }), { tier: "bronze" });
  assert.deepEqual(calls, [
    { fn: "evaluate", stage: "bronze" },
    { fn: "evaluate", stage: "silver" },
    { fn: "onAchieved", stage: "bronze" },
  ]);
  assert.equal(registry.getMilestoneByKey("rank_silver")?.series?.seriesKey, "rank_up");
  assert.equal(registry.getMilestoneByKey("rank_up"), undefined, "シリーズの鍵は定義としては引けない");
});

test("シリーズ: onAchieved の無いシリーズの段階は onAchieved を持たない", () => {
  tiers = [{ key: "bronze", threshold: 1 }];
  const series = rankSeries();
  delete series.onAchieved;
  items.push(series);
  assert.equal(registry.getAllMilestones()[0].onAchieved, undefined);
});

test("stages は呼ぶたびに読み直す(段階を足す・消すと次の呼び出しで変わる)", () => {
  tiers = [{ key: "bronze", threshold: 3000 }];
  items.push(rankSeries());
  assert.deepEqual(registry.getAllMilestones().map((d) => d.key), ["rank_bronze"]);
  tiers = [
    { key: "bronze", threshold: 3000 },
    { key: "gold", threshold: 30000 },
  ];
  assert.deepEqual(registry.getMilestonesByTrigger("purchase_completed").map((d) => d.key), ["rank_bronze", "rank_gold"]);
  tiers = [{ key: "gold", threshold: 30000 }];
  assert.deepEqual(registry.getAllMilestones().map((d) => d.key), ["rank_gold"]);
  assert.equal(registry.getMilestoneByKey("rank_bronze"), undefined, "消した段階は評価されない(記録は残る)");
});

test("鍵の重複は例外(5 通り)", () => {
  tiers = [
    { key: "bronze", threshold: 1 },
    { key: "silver", threshold: 2 },
  ];
  const cases: { name: string; list: MilestoneItem[] }[] = [
    { name: "普通どうし", list: [plain("a"), plain("a")] },
    { name: "シリーズの中の段階どうし", list: [{ ...rankSeries(), stageKey: () => "rank_same" }] },
    { name: "シリーズをまたぐ段階", list: [rankSeries(), { ...rankSeries(), key: "rank_up_2" }] },
    { name: "普通と段階", list: [plain("rank_bronze"), rankSeries()] },
    { name: "シリーズの鍵と普通", list: [rankSeries(), plain("rank_up")] },
  ];
  for (const { name, list } of cases) {
    items.length = 0;
    items.push(...list);
    assert.throws(() => registry.getAllMilestones(), /が複数あります/, name);
  }
});

test("空の stageKey は例外", () => {
  tiers = [{ key: "bronze", threshold: 1 }];
  items.push({ ...rankSeries(), stageKey: () => " " });
  assert.throws(() => registry.getAllMilestones(), /stageKey が空/);
});

test("expandMilestoneItems: 受け口の一覧によらず同じ規則で展開する(シリーズの段階が 0 ならシリーズの鍵だけ取る)", () => {
  tiers = [];
  assert.deepEqual(registry.expandMilestoneItems([rankSeries(), plain("x")]).map((d) => d.key), ["x"]);
  assert.throws(() => registry.expandMilestoneItems([rankSeries(), plain("rank_up")]), /が複数あります/);
});
