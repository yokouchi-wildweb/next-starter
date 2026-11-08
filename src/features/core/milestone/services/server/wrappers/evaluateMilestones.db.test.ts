// 評価エンジンの実 DB テスト(記録を確定してから付与・同時実行・sequential の飛ばし)。
// 開発 DB の milestones に乱数の user_id の行だけを書き、終了時に消す(それ以外の表には書かない)。読み手は偽物。
// DATABASE_URL が無ければ全件 skip。
// 実行: pnpm test --db src/features/core/milestone/services/server/wrappers/evaluateMilestones.db.test.ts

import { after, before, beforeEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";
import { and, eq, inArray } from "drizzle-orm";

import type { MilestoneDefinition } from "../../../types/milestone";

const envFile = resolve(process.cwd(), process.env.ENV_FILE ?? ".env.development");
if (existsSync(envFile)) loadEnv({ path: envFile, quiet: true });

const skip = (process.env.DATABASE_URL ?? "").trim().length === 0;

let definitions: MilestoneDefinition[] = [];
mock.module("../milestoneRegistry", { namedExports: { getMilestonesByTrigger: () => definitions } });

describe("evaluateMilestones(実 DB)", { skip, timeout: 60000 }, () => {
  let db: typeof import("@/lib/drizzle").db;
  let MilestoneTable: typeof import("@/features/core/milestone/entities/drizzle").MilestoneTable;
  let evaluateMilestones: typeof import("./evaluateMilestones").evaluateMilestones;
  const users: string[] = [];
  let userId = "";

  before(async () => {
    ({ db } = await import("@/lib/drizzle"));
    ({ MilestoneTable } = await import("@/features/core/milestone/entities/drizzle"));
    ({ evaluateMilestones } = await import("./evaluateMilestones"));
  });
  beforeEach(() => {
    userId = randomUUID();
    users.push(userId);
    definitions = [];
  });
  after(async () => {
    if (users.length) await db.delete(MilestoneTable).where(inArray(MilestoneTable.user_id, users));
    await (db as unknown as { $client?: { end: () => Promise<void> } }).$client?.end();
  });

  const recorded = async () =>
    (
      await db
        .select({ key: MilestoneTable.milestone_key, metadata: MilestoneTable.metadata })
        .from(MilestoneTable)
        .where(eq(MilestoneTable.user_id, userId))
    ).sort((a, b) => a.key.localeCompare(b.key));

  test("同じ利用者で 2 つの tx が同時に評価しても onAchieved は 1 回・記録は 1 行", { timeout: 40000 }, async () => {
    let grants = 0;
    // 両方の tx が evaluate を通ってから記録へ進むよう、evaluate で待ち合わせる
    let arrived = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    definitions = [
      {
        key: "test_db_race",
        triggers: ["t"],
        evaluate: async () => {
          arrived += 1;
          if (arrived === 2) release();
          await gate;
          return true;
        },
        onAchieved: async () => {
          grants += 1;
          return { grant: grants };
        },
      },
    ];
    const once = () => db.transaction((tx) => evaluateMilestones("t", { userId, payload: {} }, tx));
    const [a, b] = await Promise.all([once(), once()]);
    assert.equal(grants, 1, "onAchieved は 1 回");
    assert.equal(a.results.length + b.results.length, 1, "結果に出るのは片方だけ");
    const rows = await recorded();
    assert.deepEqual(rows, [{ key: "test_db_race", metadata: { grant: 1 } }]);
  });

  test("onAchieved が投げると記録も残らない(tx あり・なしの両方)", { timeout: 40000 }, async () => {
    const failing: MilestoneDefinition = {
      key: "test_db_fail",
      triggers: ["t"],
      evaluate: async () => true,
      onAchieved: async () => {
        throw new Error("付与に失敗");
      },
    };
    definitions = [failing];
    const restore = console.error;
    console.error = () => {};
    try {
      await db.transaction((tx) => evaluateMilestones("t", { userId, payload: {} }, tx));
      await evaluateMilestones("t", { userId, payload: {} });
    } finally {
      console.error = restore;
    }
    assert.deepEqual(await recorded(), []);
  });

  test("sequential で 2 段飛ばすと下から 3 行、上の段の印で下の段が分かる", { timeout: 40000 }, async () => {
    const seen: [string, boolean | undefined][] = [];
    const tier = (key: string, index: number, ok: boolean): MilestoneDefinition => ({
      key,
      triggers: ["t"],
      evaluate: async () => ok,
      onAchieved: async (params) => {
        seen.push([params.milestoneKey, params.series?.viaHigherStage]);
        return { stage: key };
      },
      series: { seriesKey: "test_db_rank", stageKey: key, index, order: "sequential" },
    });
    definitions = [tier("test_db_r1", 0, false), tier("test_db_r2", 1, false), tier("test_db_r3", 2, true), tier("test_db_r4", 3, false)];
    const result = await db.transaction((tx) => evaluateMilestones("t", { userId, payload: {} }, tx));
    assert.deepEqual(result.results.map((r) => r.key), ["test_db_r1", "test_db_r2", "test_db_r3"]);
    assert.deepEqual(seen, [
      ["test_db_r1", true],
      ["test_db_r2", true],
      ["test_db_r3", false],
    ]);
    assert.deepEqual(
      (await recorded()).map((r) => r.key),
      ["test_db_r1", "test_db_r2", "test_db_r3"],
    );
    // 2 回目は全部達成済みで何もしない
    const again = await db.transaction((tx) => evaluateMilestones("t", { userId, payload: {} }, tx));
    assert.deepEqual(again.results, []);
    const left = await db
      .select({ key: MilestoneTable.milestone_key })
      .from(MilestoneTable)
      .where(and(eq(MilestoneTable.user_id, userId), eq(MilestoneTable.milestone_key, "test_db_r4")));
    assert.deepEqual(left, []);
  });
});
