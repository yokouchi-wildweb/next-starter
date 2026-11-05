// scripts/db/seed/gate.test.ts(pnpm test:db-seed)
// seed と機能の門: 閉じた項目を飛ばす計算・表が無いエラーの見分け・閉じられるフォルダを import する項目の feature の検査。

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { resolveImport } from "../../../eslint-rules/resolve-import.mjs";
import { valueImportSources } from "../../../src/featureGate/checks/importSources.mjs";
import { rules } from "../../../src/featureGate/node";

import { seedRegistry } from "./data/registry";
import { featuresOf, isUndefinedTableError, missingSeedFeatures, partitionSeeds, seedFilesByKey } from "./gate";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "../../..");
const DATA_DIR = join(ROOT, "scripts/db/seed/data");

test("featuresOf: 無し・1 つ・配列", () => {
  assert.deepEqual(featuresOf({}), []);
  assert.deepEqual(featuresOf({ feature: "a" }), ["a"]);
  assert.deepEqual(featuresOf({ feature: ["a", "b"] }), ["a", "b"]);
});

test("partitionSeeds: 全部開・一部閉・feature 無し", () => {
  const seeds = [
    { key: "plain" },
    { key: "one", feature: "a" },
    { key: "many", feature: ["a", "b", "c"] },
  ];
  const allOpen = partitionSeeds(seeds, () => true);
  assert.deepEqual(allOpen.run.map((s) => s.key), ["plain", "one", "many"]);
  assert.deepEqual(allOpen.skipped, []);

  const closedB = partitionSeeds(seeds, (f) => f !== "b" && f !== "c");
  assert.deepEqual(closedB.run.map((s) => s.key), ["plain", "one"]);
  assert.deepEqual(closedB.skipped.map((s) => [s.seed.key, s.closed]), [["many", ["b", "c"]]]);

  const closedA = partitionSeeds(seeds, (f) => f !== "a");
  assert.deepEqual(closedA.run.map((s) => s.key), ["plain"]);
  assert.deepEqual(closedA.skipped.map((s) => [s.seed.key, s.closed]), [["one", ["a"]], ["many", ["a"]]]);
});

test("isUndefinedTableError: 42P01 を cause までたどる", () => {
  assert.equal(isUndefinedTableError({ code: "42P01" }), true);
  assert.equal(isUndefinedTableError(Object.assign(new Error("Failed query"), { cause: { code: "42P01" } })), true);
  assert.equal(isUndefinedTableError({ code: "23505" }), false);
  assert.equal(isUndefinedTableError(new Error("x")), false);
  assert.equal(isUndefinedTableError(undefined), false);
});

test("seedFilesByKey: 項目ごとの import(\"./x\") を読む", () => {
  const text = `
    // key: "commented" import("./nope")
    { name: "A", key: "a", deps: [], fn: async () => { const { f } = await import("./aFile"); return f({ x: { y: 1 } }); } },
    { name: "B", key: "b", deps: ["a"], fn: async (deps) => (await import("../shared/bFile")).g(deps.a) },
    { name: "C", key: "c", deps: [], fn: async () => undefined },
  `;
  assert.deepEqual([...seedFilesByKey(text)], [["a", "./aFile"], ["b", "../shared/bFile"]]);
});

/** seed のファイル(registry からの相対)が値で import する先(repo 相対、解決済み) */
function importedPathsOf(file: string): string[] {
  const path = join(DATA_DIR, `${file}.ts`);
  const text = readFileSync(path, "utf8");
  return valueImportSources(text).map((source: string) => resolveImport(source, path, ROOT)).filter(Boolean);
}

test("上流の seed: 閉じられるフォルダを import する項目は全部 feature を持つ(0 件)", () => {
  const filesByKey = seedFilesByKey(readFileSync(join(DATA_DIR, "registry.ts"), "utf8"));
  for (const seed of seedRegistry) assert.ok(filesByKey.has(seed.key), `registry.ts の ${seed.key} の import("./…") が読めない`);
  const missing = missingSeedFeatures({ seeds: seedRegistry, filesByKey, rules, importedPathsOf });
  assert.deepEqual(
    missing,
    [],
    missing.map((m) => `seed の項目 ${m.key}(${m.file})は閉じられるフォルダ ${m.folder} を import する → feature: "${m.rule}" を付ける`).join("\n"),
  );
});

test("上流の seed: sample 系 3 項目は sampleDomain が閉じると飛ぶ", () => {
  const { skipped } = partitionSeeds(seedRegistry, (f) => f !== "sampleDomain");
  assert.deepEqual(skipped.map((s) => s.seed.key), ["sampleTags", "sampleCategories", "samples"]);
});

test("missingSeedFeatures: feature の無い項目・違う規則の項目を落とす(fixture)", () => {
  const fixtureRules = [
    { name: "shop", features: ["shop", "core/wallet"] },
    { name: "blog", features: ["blog"] },
  ];
  const imports: Record<string, string[]> = {
    "./shop": ["src/features/shop/services/server/shopService", "src/lib/drizzle"],
    "./wallet": ["src/features/core/wallet/entities/drizzle"],
    "./blog": ["src/features/blog"],
    "./plain": ["src/features/core/user/entities/drizzle"],
    "./shopping": ["src/features/shopping/x"],
  };
  const seeds = [
    { key: "shop" },
    { key: "wallet", feature: "blog" },
    { key: "blog", feature: ["blog"] },
    { key: "plain" },
    { key: "shopping" },
  ];
  const filesByKey = new Map(seeds.map((s) => [s.key, `./${s.key}`]));
  const missing = missingSeedFeatures({ seeds, filesByKey, rules: fixtureRules, importedPathsOf: (f) => imports[f] ?? [] });
  assert.deepEqual(missing, [
    { key: "shop", file: "./shop", folder: "shop", rule: "shop" },
    { key: "wallet", file: "./wallet", folder: "core/wallet", rule: "shop" },
  ]);
});
