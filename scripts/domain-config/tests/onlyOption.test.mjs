// dc:generate の `--only <category>` の回帰テスト。
// 実行: pnpm test:dc-only
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOnlyOption } from "../cli/args.mjs";
import { GENERATE_CATEGORIES, narrowGenerateTargets } from "../spec/categories.mjs";

test("parseOnlyOption: --only の値をドメイン名と取り違えないよう取り除く", () => {
  assert.deepEqual(parseOnlyOption(["--generate", "--only", "registry", "Sample", "--yes"]), {
    only: ["registry"],
    rest: ["--generate", "Sample", "--yes"],
  });
  assert.deepEqual(parseOnlyOption(["--generate", "--all", "--only=registry,hooks"]), {
    only: ["registry", "hooks"],
    rest: ["--generate", "--all"],
  });
  assert.deepEqual(parseOnlyOption(["--generate", "Sample"]), { only: null, rest: ["--generate", "Sample"] });
});

test("parseOnlyOption: 値なし・不明なカテゴリはエラー", () => {
  assert.throws(() => parseOnlyOption(["--generate", "--only"]), /カテゴリを指定/);
  assert.throws(() => parseOnlyOption(["--generate", "--only", "--yes"]), /カテゴリを指定/);
  assert.throws(() => parseOnlyOption(["--only", "registry,services"]), /不明なカテゴリ.*services/);
});

test("narrowGenerateTargets: generateFiles を広げず、true のカテゴリを絞り込むだけ", () => {
  const gen = Object.fromEntries(GENERATE_CATEGORIES.map((c) => [c, c !== "entities"]));
  const { gen: narrowed, skipped } = narrowGenerateTargets(gen, ["registry", "entities"]);
  assert.deepEqual(
    GENERATE_CATEGORIES.filter((c) => narrowed[c]),
    ["registry"],
  );
  assert.deepEqual(skipped, ["entities"]);
});

test("narrowGenerateTargets: only が null なら元のまま", () => {
  const gen = { registry: true, hooks: false };
  assert.deepEqual(narrowGenerateTargets(gen, null), { gen, skipped: [] });
});
