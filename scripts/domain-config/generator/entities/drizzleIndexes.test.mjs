// dc:generate の entities/drizzle.ts: domain.json indexes の using（方式）/ opclass（演算子クラス）出力の回帰テスト。
// 実行: pnpm test:dc-drizzle-indexes
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const generator = path.join(repoRoot, "scripts", "domain-config", "generator", "entities", "generate-drizzle-entity.mjs");
const baseConfig = JSON.parse(fs.readFileSync(path.join(repoRoot, "src", "features", "sampleTag", "domain.json"), "utf8"));
const tmpDirs = [];
after(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});

// ジェネレーターは process.cwd() の src/features を見るので、一時ディレクトリに domain.json を置いて実行する
function generate(indexes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dc-drizzle-indexes-"));
  tmpDirs.push(dir);
  const domainDir = path.join(dir, "src", "features", "sampleTag");
  fs.mkdirSync(domainDir, { recursive: true });
  const config = { ...baseConfig };
  if (indexes === undefined) delete config.indexes;
  else config.indexes = indexes;
  fs.writeFileSync(path.join(domainDir, "domain.json"), JSON.stringify(config));
  const result = spawnSync("node", [generator, "sampleTag"], { cwd: dir, encoding: "utf8" });
  const outFile = path.join(domainDir, "entities", "drizzle.ts");
  return { result, output: fs.existsSync(outFile) ? fs.readFileSync(outFile, "utf8") : null };
}

test("using / opclass が無ければ従来どおり .on(...) を出す", () => {
  const { result, output } = generate([{ fields: ["name"] }]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(output, /\n  \/\/ インデックス: \[name\]\n  index\("sample_tags_name_idx"\)\.on\(table\.name\)/);
});

test("gin + opclass は .using(...) と .op(...) を出し、既定名に方式を付ける", () => {
  const { result, output } = generate([{ fields: ["name"], using: "gin", opclass: { name: "gin_trgm_ops" } }]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    output,
    /\n  \/\/ インデックス: \[name\] \(gin\)\n  index\("sample_tags_name_gin_idx"\)\.using\("gin", table\.name\.op\("gin_trgm_ops"\)\)/,
  );
});

test("btree の opclass は .on(...) のまま列に .op(...) を付け、name と where も使える", () => {
  const { result, output } = generate([
    { fields: ["name", "createdAt"], using: "btree", opclass: { name: "text_pattern_ops" }, where: "deleted_at IS NULL", name: "tags_name_pattern_idx" },
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    output,
    /index\("tags_name_pattern_idx"\)\.on\(table\.name\.op\("text_pattern_ops"\), table\.createdAt\)\.where\(sql`deleted_at IS NULL`\)/,
  );
});

test("不正な using / opclass は何も書かずにエラー終了する", () => {
  const cases = [
    [{ fields: ["name"], using: "gin; drop" }, /using "gin; drop" が不正/],
    [{ fields: ["name"], using: "gin", opclass: { other: "gin_trgm_ops" } }, /opclass のキー "other" が fields にありません/],
    [{ fields: ["name"], using: "gin", opclass: { name: 'x")' } }, /opclass "name": "x"\)" が不正/],
    [{ fields: ["name"], opclass: ["gin_trgm_ops"] }, /opclass は \{ "<field>": "<演算子クラス>" \} の形/],
  ];
  for (const [index, pattern] of cases) {
    const { result, output } = generate([index]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, pattern);
    assert.equal(output, null);
  }
});
