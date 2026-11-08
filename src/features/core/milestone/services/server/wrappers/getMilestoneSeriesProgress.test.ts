// シリーズの進み具合の読み手の検査(受け口の一覧と DB は偽物)。
// - 今の stages の並びで達成済み・次・残りを返す(消した段階の記録は出ない)
// - シリーズが無い・普通の定義の鍵 → null、段階が 0 → DB を読まず空
// 実行: pnpm test src/features/core/milestone/services/server/wrappers/getMilestoneSeriesProgress.test.ts
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";

import type { MilestoneItem } from "../../../types/milestone";

let tiers: { key: string }[] = [];
let recorded: { key: string; achievedAt: Date }[] = [];
let reads = 0;
const items: MilestoneItem[] = [];
mock.module("@/features/core/milestone/extensions/definitions", { namedExports: { definitions: items } });
mock.module("@/lib/drizzle", {
  namedExports: {
    db: {
      select: () => ({
        from: () => ({
          where: async () => {
            reads += 1;
            return recorded;
          },
        }),
      }),
    },
  },
});

let getMilestoneSeriesProgress: typeof import("./getMilestoneSeriesProgress").getMilestoneSeriesProgress;
before(async () => {
  ({ getMilestoneSeriesProgress } = await import("./getMilestoneSeriesProgress"));
  items.push(
    { key: "first_purchase", triggers: ["t"], evaluate: async () => true },
    {
      kind: "series",
      key: "rank_up",
      triggers: ["t"],
      order: "sequential",
      stages: () => tiers,
      stageKey: (tier: { key: string }) => `rank_${tier.key}`,
      evaluate: async () => false,
    },
  );
});
beforeEach(() => {
  reads = 0;
});

const at = new Date("2026-11-08T00:00:00Z");

test("達成済み・次・残りを今の stages の並びで返し、消した段階の記録は出さない", async () => {
  tiers = [{ key: "bronze" }, { key: "silver" }, { key: "gold" }];
  recorded = [
    { key: "rank_bronze", achievedAt: at },
    { key: "rank_removed", achievedAt: at },
  ];
  const progress = await getMilestoneSeriesProgress("u1", "rank_up");
  assert.deepEqual(progress, {
    seriesKey: "rank_up",
    order: "sequential",
    stages: [
      { stageKey: "rank_bronze", index: 0, achieved: true, achievedAt: at },
      { stageKey: "rank_silver", index: 1, achieved: false, achievedAt: null },
      { stageKey: "rank_gold", index: 2, achieved: false, achievedAt: null },
    ],
    achievedKeys: ["rank_bronze"],
    next: "rank_silver",
    remaining: 2,
  });
});

test("全部済みなら next は null・remaining 0", async () => {
  tiers = [{ key: "bronze" }];
  recorded = [{ key: "rank_bronze", achievedAt: at }];
  const progress = await getMilestoneSeriesProgress("u1", "rank_up");
  assert.equal(progress?.next, null);
  assert.equal(progress?.remaining, 0);
});

test("シリーズが無い・普通の定義の鍵は null、段階が 0 なら DB を読まない", async () => {
  assert.equal(await getMilestoneSeriesProgress("u1", "nope"), null);
  assert.equal(await getMilestoneSeriesProgress("u1", "first_purchase"), null);
  tiers = [];
  const empty = await getMilestoneSeriesProgress("u1", "rank_up");
  assert.deepEqual([empty?.stages, empty?.next, empty?.remaining, reads], [[], null, 0, 0]);
});
