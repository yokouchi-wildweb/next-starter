// dc:generate の entities/drizzle.ts: domain.json indexes の using（方式）/ opclass（演算子クラス）出力の回帰テスト。
// 実行: pnpm test:dc-drizzle-indexes
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { renderDrizzleEntity } from "../render/entities/drizzle/index.mjs";
import { contextFor, makeProject, removeAll, repoRoot } from "./helpers.mjs";

const baseConfig = JSON.parse(fs.readFileSync(path.join(repoRoot, "src", "features", "sampleTag", "domain.json"), "utf8"));
const cleanup = [];
after(() => removeAll(cleanup));

/** indexes を差し替えた sampleTag を生成し、本文か例外を返す */
function generate(indexes) {
  const config = { ...baseConfig };
  if (indexes === undefined) delete config.indexes;
  else config.indexes = indexes;
  const root = makeProject({ configs: { sampleTag: config }, cleanup });
  const { workspace, ctx } = contextFor(root, "sampleTag");
  try {
    return { output: renderDrizzleEntity(ctx, workspace), error: null };
  } catch (error) {
    return { output: null, error };
  }
}

test("using / opclass が無ければ従来どおり .on(...) を出す", () => {
  const { output, error } = generate([{ fields: ["name"] }]);
  assert.equal(error, null);
  assert.match(output, /\n  \/\/ インデックス: \[name\]\n  index\("sample_tags_name_idx"\)\.on\(table\.name\)/);
});

test("gin + opclass は .using(...) と .op(...) を出し、既定名に方式を付ける", () => {
  const { output, error } = generate([{ fields: ["name"], using: "gin", opclass: { name: "gin_trgm_ops" } }]);
  assert.equal(error, null);
  assert.match(output, /\n  \/\/ インデックス: \[name\] \(gin\)\n  index\("sample_tags_name_gin_idx"\)\.using\("gin", table\.name\.op\("gin_trgm_ops"\)\)/);
});

test("btree の opclass は .on(...) のまま列に .op(...) を付け、name と where も使える", () => {
  const { output, error } = generate([
    { fields: ["name", "createdAt"], using: "btree", opclass: { name: "text_pattern_ops" }, where: "deleted_at IS NULL", name: "tags_name_pattern_idx" },
  ]);
  assert.equal(error, null);
  assert.match(output, /index\("tags_name_pattern_idx"\)\.on\(table\.name\.op\("text_pattern_ops"\), table\.createdAt\)\.where\(sql`deleted_at IS NULL`\)/);
});

test("不正な using / opclass は何も作らずエラーにする", () => {
  const cases = [
    [{ fields: ["name"], using: "gin; drop" }, /using "gin; drop" が不正/],
    [{ fields: ["name"], using: "gin", opclass: { other: "gin_trgm_ops" } }, /opclass のキー "other" が fields にありません/],
    [{ fields: ["name"], using: "gin", opclass: { name: 'x")' } }, /opclass "name": "x"\)" が不正/],
    [{ fields: ["name"], opclass: ["gin_trgm_ops"] }, /opclass は \{ "<field>": "<演算子クラス>" \} の形/],
  ];
  for (const [index, pattern] of cases) {
    const { output, error } = generate([index]);
    assert.equal(output, null);
    assert.match(error.message, pattern);
  }
});

test("インデックス名が 63 文字を超えればエラーにする", () => {
  const { error } = generate([{ fields: ["name"], name: "x".repeat(64) }]);
  assert.match(error.message, /63 文字を超えています/);
});
