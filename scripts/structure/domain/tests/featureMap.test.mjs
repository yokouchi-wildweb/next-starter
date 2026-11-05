// ドメインの一覧（src/features/feature-map.txt）と、--only の名指し（generate: false は名指ししても書かない）の契約テスト。
// 実行: pnpm test:dc-feature-map
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { FEATURE_MAP_FILE, buildFeatureMap, featureMapDiff } from "../domain/featureMap.mjs";
import { createWorkspace } from "../domain/workspace.mjs";
import { configTargets, refreshFeatureMap } from "../pipeline/generate.mjs";
import { GENERATE_CATEGORIES } from "../spec/categories.mjs";
import { makeProject, removeAll, repoRoot } from "./helpers.mjs";

const cleanup = [];
after(() => removeAll(cleanup));
const SILENT = { log: () => {}, warn: () => {} };
const rows = (text) => text.split("\n").filter((line) => line && !line.startsWith("#"));
const onOf = (gen) => GENERATE_CATEGORIES.filter((c) => gen[c]);
const mapOf = (root) => buildFeatureMap(createWorkspace(root).featureListing());
const writeFeatureMap = (root) => refreshFeatureMap(createWorkspace(root), SILENT);
const checkFeatureMap = (root) => featureMapDiff(mapOf(root), createWorkspace(root).readFeatureMap());

function project() {
  const root = makeProject({
    configs: { alpha: { singular: "alpha" }, beta: { singular: "beta", generate: false }, "core/tag": { singular: "tag", generate: false }, "core/memo": { singular: "memo" } },
    cleanup,
  });
  for (const dir of ["src/features/handMade", "src/features/_template", "src/features/core/user", "src/features/core/_draft"]) fs.mkdirSync(path.join(root, dir), { recursive: true });
  return root;
}

test("一覧: business・core とも domain.json の有無と generate を 1 行ずつ、_ で始まるフォルダは数えない", () => {
  assert.deepEqual(rows(mapOf(project())), [
    "alpha\tbusiness\tyes\ttrue",
    "beta\tbusiness\tyes\tfalse",
    "handMade\tbusiness\tno\t-",
    "core/memo\tcore\tyes\ttrue",
    "core/tag\tcore\tyes\tfalse",
    "core/user\tcore\tno\t-",
  ]);
});

test("--check: 書いた直後は一致、フォルダの増減・generate の切り替えでずれを出す", () => {
  const root = project();
  assert.equal(writeFeatureMap(root), true);
  assert.equal(writeFeatureMap(root), false);
  assert.deepEqual(checkFeatureMap(root), []);
  fs.writeFileSync(path.join(root, "src/features/alpha/domain.json"), JSON.stringify({ singular: "alpha", generate: false }));
  fs.mkdirSync(path.join(root, "src/features/gamma"));
  fs.rmSync(path.join(root, "src/features/handMade"), { recursive: true });
  assert.deepEqual(checkFeatureMap(root).sort(), ["+ alpha\tbusiness\tyes\tfalse", "+ gamma\tbusiness\tno\t-", "- alpha\tbusiness\tyes\ttrue", "- handMade\tbusiness\tno\t-"].sort());
});

test("このリポの一覧は今のフォルダ・generate と一致する", () => {
  assert.deepEqual(checkFeatureMap(repoRoot), [], `${FEATURE_MAP_FILE} を pnpm dc:feature-map で作り直してください`);
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
