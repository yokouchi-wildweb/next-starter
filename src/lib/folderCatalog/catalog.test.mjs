// src/lib/folderCatalog/catalog.test.mjs
// フォルダ目録(CATALOG.md)の契約テスト。実行: pnpm test:lib-catalog (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkCatalog,
  listDirs,
  loadCatalogOwnership,
  parseCatalog,
} from "./catalog.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

// ---- 実リポジトリの検査(これが本体) ----

test("src/lib/CATALOG.md と src/lib 直下のディレクトリが一致する", () => {
  const { sections, errors } = parseCatalog(readFileSync(join(repoRoot, "src/lib/CATALOG.md"), "utf8"));
  assert.deepEqual(errors, [], `目録の書式エラー:\n${errors.join("\n")}`);
  assert.ok(sections.length > 0, "節が 1 つもありません");
  const problems = checkCatalog({ sections, folder: "src/lib", dirs: listDirs(repoRoot, "src/lib") });
  assert.deepEqual(problems, [], `目録の不一致:\n${problems.join("\n")}`);
});

// ---- 部品 ----

test("parseCatalog: 見出しは fork の名前の形(小文字・数字・ハイフン)。origin 由来の長い ID・大文字は書式エラー", () => {
  assert.deepEqual(parseCatalog("## next-starter\n- src/lib/a — a\n").errors, []);
  assert.equal(parseCatalog("## yokouchi-wildweb--next-starter\n").errors.length, 1);
  assert.equal(parseCatalog("## TriQ\n").errors.length, 1);
});

test("空の節(中間 Tier が lib を足していない・名前の節だけ置いた)は書式エラーにも不一致にもしない", () => {
  const { sections, errors } = parseCatalog("## next-starter\n- src/lib/a — a\n\n## oripa-do\n\n## pandora\n- src/lib/b — b\n");
  assert.deepEqual(errors, []);
  assert.deepEqual(sections.map((s) => [s.owner, s.entries.length]), [["next-starter", 1], ["oripa-do", 0], ["pandora", 1]]);
  assert.deepEqual(checkCatalog({ sections, folder: "src/lib", dirs: ["a", "b"] }), []);
});

const SAMPLE = `# 目録
説明文の箇条書きは無視される:
- 自分の節に 1 行足す

## acme-base
- src/lib/a — ライブラリ A
- src/lib/b — ライブラリ B

## acme-fork
- src/lib/c — fork のライブラリ
`;

test("parseCatalog: 最初の見出しより前は説明文として読み飛ばし、節と行を読む", () => {
  const { sections, errors } = parseCatalog(SAMPLE);
  assert.deepEqual(errors, []);
  assert.deepEqual(
    sections.map((s) => [s.owner, s.entries.map((e) => e.path)]),
    [
      ["acme-base", ["src/lib/a", "src/lib/b"]],
      ["acme-fork", ["src/lib/c"]],
    ],
  );
});

test("parseCatalog: 書式違い・空の説明・不正な所有者 ID を報告する", () => {
  const { errors } = parseCatalog("## Not An Id\n- src/lib/a\n- src/lib/b —  \n");
  assert.equal(errors.length, 3, errors.join("\n"));
});

test("checkCatalog: 一致していれば問題なし", () => {
  const { sections } = parseCatalog(SAMPLE);
  assert.deepEqual(checkCatalog({ sections, folder: "src/lib", dirs: ["a", "b", "c"] }), []);
});

test("checkCatalog: 未登録・実在しない・重複・別フォルダのパス・節の重複を報告する", () => {
  const text = `${SAMPLE}- src/lib/a — 衝突\n- src/components/x — 別フォルダ\n## acme-base\n`;
  const { sections } = parseCatalog(text);
  const problems = checkCatalog({ sections, folder: "src/lib", dirs: ["a", "c", "d"] });
  const has = (word) => problems.some((p) => p.includes(word));
  assert.ok(has('"src/lib/d" が目録にありません'), problems.join("\n")); // 未登録
  assert.ok(has('"src/lib/b"'), problems.join("\n")); // 実在しない
  assert.ok(has("重複しています"), problems.join("\n")); // a が 2 つの節に
  assert.ok(has("直下のディレクトリのパスではありません"), problems.join("\n"));
  assert.ok(has("節が 2 つあります"), problems.join("\n"));
});

test("loadCatalogOwnership: 自分の節と上流の節を分け、先頭の節なら isRoot", () => {
  const withFixture = (ownerId) =>
    loadCatalogOwnership({ repoRoot, folder: "src/lib", catalogFile: "src/lib/folderCatalog/fixtures/CATALOG.sample.md", ownerId });
  const fork = withFixture("acme-fork");
  assert.equal(fork.isRoot, false);
  assert.deepEqual(fork.ownPaths, ["src/lib/c"]);
  assert.deepEqual(fork.upstreamPaths, ["src/lib/a", "src/lib/b"]);
  const base = withFixture("acme-base");
  assert.equal(base.isRoot, true);
  const unknown = withFixture(null); // 名前が読めない → 自分の所有なし(全部上流扱い)
  assert.equal(unknown.isRoot, false);
  assert.deepEqual(unknown.ownPaths, []);
  assert.equal(unknown.upstreamPaths.length, 3);
});
