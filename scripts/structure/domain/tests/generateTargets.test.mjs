// --only の名指し(generate: false は名指ししても書かない)・CLI の既定と、生成と削除の最後に地区の地図を書き直す契約テスト。
// 実行: pnpm test scripts/structure/domain/tests/generateTargets.test.mjs
// ドメインの一覧(domain.json の有無・generate)は地区の地図 src/registry/district-map.jsonl の domainJson・generate(L1.15)
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { DISTRICT_MAP_FILE } from "../../../../src/lib/districtMap/index.mjs";
import { createWorkspace } from "../domain/workspace.mjs";
import { configTargets, refreshDistrictMap } from "../pipeline/generate.mjs";
import { GENERATE_CATEGORIES } from "../spec/categories.mjs";
import { makeProject, removeAll, repoRoot } from "./helpers.mjs";

const cleanup = [];
after(() => removeAll(cleanup));
const SILENT = { log: () => {}, warn: () => {} };
const onOf = (gen) => GENERATE_CATEGORIES.filter((c) => gen[c]);

test("生成と削除の最後: 地区の地図を今のフォルダ・generate に合わせて書き、同じなら書かない。地図に問題があれば書かずに知らせる", () => {
  const root = makeProject({ configs: { alpha: { singular: "alpha" }, beta: { singular: "beta", generate: false } }, cleanup });
  fs.mkdirSync(path.join(root, "src/registry"), { recursive: true });
  const workspace = createWorkspace(root);
  assert.equal(refreshDistrictMap(workspace, SILENT), true);
  assert.equal(refreshDistrictMap(workspace, SILENT), false);
  const rows = fs.readFileSync(path.join(root, DISTRICT_MAP_FILE), "utf8").trim().split("\n").map((line) => JSON.parse(line)).filter((d) => d.kind === "features");
  assert.deepEqual(rows.map((d) => `${d.name}:${d.domainJson}:${d.generate}`).sort(), ["alpha:true:true", "beta:true:false"]);
  fs.writeFileSync(path.join(root, "src/features/beta/domain.json"), JSON.stringify({ singular: "beta" }));
  assert.equal(refreshDistrictMap(workspace, SILENT), true);
  fs.writeFileSync(path.join(root, "src/features/beta/domain.json"), "{ broken");
  const warned = [];
  assert.equal(refreshDistrictMap(workspace, { log: () => {}, warn: (line) => warned.push(line) }), false);
  assert.match(warned.join("\n"), /pnpm check district-map/);
});

test("--only = 今回はこのカテゴリだけ: generate: false は名指ししても何も無し、従属は従属のカテゴリの内", () => {
  const pairs = { ownerOf: new Map([["child", "owner"]]) };
  const ctx = (camel, config) => ({ camel, config });
  assert.deepEqual(onOf(configTargets(ctx("x", { generate: false }), pairs, null, SILENT)), []);
  assert.deepEqual(onOf(configTargets(ctx("x", { generate: false }), pairs, ["entities", "registry"], SILENT)), []);
  assert.deepEqual(onOf(configTargets(ctx("x", {}), pairs, ["hooks"], SILENT)), ["hooks"]);
  assert.deepEqual(onOf(configTargets(ctx("child", {}), pairs, ["entities", "components"], SILENT)), ["entities"]);
  assert.deepEqual(onOf(configTargets(ctx("child", { generate: false }), pairs, ["entities", "components"], SILENT)), []);
});

test("CLI: --generate の既定は対話なし（ドメイン名が無ければ止める）、-i はドメイン名の扱いを変えない", () => {
  const index = path.join(repoRoot, "scripts/structure/domain/index.mjs");
  const noName = spawnSync("node", [index, "--generate"], { cwd: repoRoot, encoding: "utf8", input: "" });
  assert.equal(noName.status, 1);
  assert.match(noName.stderr, /ドメイン名を指定してください/);
  const dry = spawnSync("node", [index, "--generate", "sampleTag", "--dry-run", "--only", "registry"], { cwd: repoRoot, encoding: "utf8", input: "" });
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /\[dry-run\] sampleTag:/);
});
