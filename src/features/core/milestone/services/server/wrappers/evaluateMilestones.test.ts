// 評価エンジンの検査(DB は偽物: 記録の表を配列で持ち、SAVEPOINT / transaction の巻き戻しをまねる。読み手も偽物)。
// - 1 段階: 達成済みは skip、true で記録 → onAchieved → metadata、false は何もしない、エラーは他を止めない
// - 記録が先: 記録が並走に取られていたら onAchieved を呼ばない / onAchieved が投げたら記録も戻る
// - sequential: 並び順に評価、上の段の達成で下の未達成の段を下から先に達成(viaHigherStage)、既達成の段は評価しない
// - unordered: 各々独立 / achievedInThisEvaluation が後の定義に渡る / tx の無い呼び出しも 1 件ごとに transaction
// 実行: pnpm test src/features/core/milestone/services/server/wrappers/evaluateMilestones.test.ts
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";

import type { MilestoneAchievedParams, MilestoneDefinition, MilestoneSeriesOrder } from "../../../types/milestone";

type Row = { id: string; user_id: string; milestone_key: string; metadata: unknown };
let rows: Row[] = [];
let seq = 0;
const log: string[] = [];
/** 他の誰かが先に記録する鍵(insert の直前に表へ入る = 並走をまねる) */
let raceKeys = new Set<string>();

function makeExecutor(label: string) {
  const savepoints = new Map<string, Row[]>();
  let lastInsertedId: string | null = null;
  const executor = {
    select: () => ({
      from: () => ({
        where: async () => rows.filter((r) => r.user_id === "u1").map((r) => ({ milestone_key: r.milestone_key })),
      }),
    }),
    insert: () => ({
      values: (v: Omit<Row, "id">) => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            if (raceKeys.has(v.milestone_key)) rows.push({ id: `race-${v.milestone_key}`, ...v });
            if (rows.some((r) => r.user_id === v.user_id && r.milestone_key === v.milestone_key)) return [];
            const id = `id-${seq++}`;
            rows.push({ id, ...v });
            lastInsertedId = id;
            log.push(`insert:${v.milestone_key}`);
            return [{ id }];
          },
        }),
      }),
    }),
    update: () => ({
      set: (s: { metadata: unknown }) => ({
        where: async () => {
          const row = rows.find((r) => r.id === lastInsertedId);
          if (row) row.metadata = s.metadata;
        },
      }),
    }),
    execute: async (query: { queryChunks?: { value?: string[] }[] } | unknown) => {
      const text = JSON.stringify(query);
      const name = /milestone_eval_\d+/.exec(text)?.[0] ?? "";
      if (text.includes("ROLLBACK TO SAVEPOINT")) rows = savepoints.get(name) ?? rows;
      else if (text.includes("RELEASE SAVEPOINT")) savepoints.delete(name);
      else if (text.includes("SAVEPOINT")) savepoints.set(name, rows.map((r) => ({ ...r })));
    },
    transaction: async <T,>(run: (inner: unknown) => Promise<T>): Promise<T> => {
      const snapshot = rows.map((r) => ({ ...r }));
      log.push(`${label}:transaction`);
      try {
        return await run(makeExecutor(`${label}-inner`));
      } catch (error) {
        rows = snapshot;
        throw error;
      }
    },
  };
  return executor;
}

const fakeDb = makeExecutor("db");
let definitions: MilestoneDefinition[] = [];
mock.module("@/lib/drizzle", { namedExports: { db: fakeDb } });
mock.module("../milestoneRegistry", { namedExports: { getMilestonesByTrigger: () => definitions } });

let evaluateMilestones: typeof import("./evaluateMilestones").evaluateMilestones;
before(async () => {
  ({ evaluateMilestones } = await import("./evaluateMilestones"));
});
beforeEach(() => {
  rows = [];
  seq = 0;
  log.length = 0;
  raceKeys = new Set();
  definitions = [];
  mock.method(console, "error", () => {});
});

const achievedParams: MilestoneAchievedParams[] = [];
const def = (key: string, ok: boolean | (() => boolean), extra: Partial<MilestoneDefinition> = {}): MilestoneDefinition => ({
  key,
  triggers: ["t"],
  evaluate: async (context) => {
    log.push(`evaluate:${key}:${[...(context.achievedInThisEvaluation ?? [])].join(",")}`);
    return typeof ok === "function" ? ok() : ok;
  },
  onAchieved: async (params) => {
    log.push(`onAchieved:${key}`);
    achievedParams.push(params);
    return { granted: key };
  },
  ...extra,
});
const stage = (seriesKey: string, key: string, index: number, ok: boolean, order: MilestoneSeriesOrder = "sequential") =>
  def(key, ok, { series: { seriesKey, stageKey: key, index, order } });

const tx = makeExecutor("tx") as never;
const run = (withTx = true) => evaluateMilestones("t", { userId: "u1", payload: {} }, withTx ? tx : undefined);

test("1 段階: true で記録 → onAchieved → metadata、false と達成済みは何もしない", async () => {
  rows.push({ id: "old", user_id: "u1", milestone_key: "done", metadata: null });
  definitions = [def("done", true), def("a", true), def("b", false)];
  achievedParams.length = 0;
  const result = await run();
  assert.deepEqual(result.results, [{ key: "a", achieved: true, metadata: { granted: "a" } }]);
  assert.deepEqual(log, ["evaluate:a:", "insert:a", "onAchieved:a", "evaluate:b:a"]);
  assert.deepEqual(rows.find((r) => r.milestone_key === "a")?.metadata, { granted: "a" });
  assert.equal(achievedParams[0].series, undefined);
});

test("記録が先: 並走が先に記録していたら onAchieved を呼ばず結果にも出さない", async () => {
  raceKeys = new Set(["a"]);
  definitions = [def("a", true)];
  const result = await run();
  assert.deepEqual(result.results, []);
  assert.ok(!log.includes("onAchieved:a"));
  assert.equal(rows.filter((r) => r.milestone_key === "a").length, 1);
});

test("onAchieved が投げたら記録も戻り、他の定義は続く", async () => {
  definitions = [
    def("a", true, { onAchieved: async () => { throw new Error("付与に失敗"); } }),
    def("b", true),
  ];
  const result = await run();
  assert.deepEqual(result.results.map((r) => r.key), ["b"]);
  assert.ok(!rows.some((r) => r.milestone_key === "a"), "a の記録は戻る");
});

test("tx の無い呼び出しも 1 件ごとに transaction の中で記録 → onAchieved(onAchieved に tx が渡る)", async () => {
  definitions = [def("a", true), def("b", true, { onAchieved: async () => { throw new Error("x"); } })];
  achievedParams.length = 0;
  const result = await run(false);
  assert.deepEqual(result.results.map((r) => r.key), ["a"]);
  assert.equal(log.filter((l) => l === "db:transaction").length, 2);
  assert.ok(achievedParams[0].tx, "記録と同じ tx が渡る");
  assert.ok(!rows.some((r) => r.milestone_key === "b"));
});

test("sequential: 上の段の達成で下の未達成の段を下から先に達成(viaHigherStage)、既達成の段は評価しない", async () => {
  rows.push({ id: "old", user_id: "u1", milestone_key: "rank_bronze", metadata: null });
  // silver は条件が false でも gold が達成したので下から達成させる
  definitions = [
    stage("rank", "rank_bronze", 0, true),
    stage("rank", "rank_silver", 1, false),
    stage("rank", "rank_gold", 2, true),
    stage("rank", "rank_diamond", 3, false),
  ];
  achievedParams.length = 0;
  const result = await run();
  assert.deepEqual(result.results.map((r) => r.key), ["rank_silver", "rank_gold"]);
  assert.deepEqual(log, [
    "evaluate:rank_silver:",
    "evaluate:rank_gold:",
    "insert:rank_silver",
    "onAchieved:rank_silver",
    "insert:rank_gold",
    "onAchieved:rank_gold",
    "evaluate:rank_diamond:rank_silver,rank_gold",
  ]);
  assert.deepEqual(
    achievedParams.map((p) => [p.milestoneKey, p.series?.reachedStageKey, p.series?.viaHigherStage]),
    [
      ["rank_silver", "rank_gold", true],
      ["rank_gold", "rank_gold", false],
    ],
  );
});

test("sequential: 1 回で 3 段を越えると下から 3 件", async () => {
  definitions = [stage("rank", "s1", 0, true), stage("rank", "s2", 1, true), stage("rank", "s3", 2, true)];
  const result = await run();
  assert.deepEqual(result.results.map((r) => r.key), ["s1", "s2", "s3"]);
  assert.deepEqual(rows.map((r) => r.milestone_key), ["s1", "s2", "s3"]);
});

test("unordered: 各々独立(下の段を補わない)、achievedInThisEvaluation は後の定義に渡る", async () => {
  definitions = [
    stage("unlock", "u_a", 0, false, "unordered"),
    stage("unlock", "u_b", 1, true, "unordered"),
    def("after", true),
  ];
  achievedParams.length = 0;
  const result = await run();
  assert.deepEqual(result.results.map((r) => r.key), ["u_b", "after"]);
  assert.ok(log.includes("evaluate:after:u_b"));
  assert.equal(achievedParams[0].series?.viaHigherStage, false);
});

test("評価のエラーは false 扱い(他を止めない)", async () => {
  definitions = [def("a", () => { throw new Error("評価に失敗"); }), def("b", true)];
  const result = await run();
  assert.deepEqual(result.results.map((r) => r.key), ["b"]);
});
