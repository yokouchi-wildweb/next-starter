// cn() (tailwind-merge) のカスタムクラスグループ登録の契約テスト。
// 実行: pnpm test:cn （node:test + Node 組み込みの TypeScript type stripping。追加依存なし）
//
// 背景: tailwind-merge は未知の `text-*` を文字色と分類するため、theme.css で
// 定義した流体フォントサイズ text-fluid-* を font-size グループに登録しないと
// 文字色ユーティリティと共存できない（ボタンのラベル色が消える等）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { cn, FLUID_TEXT_SIZES } from "./index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const themeCssPath = resolve(here, "../../styles/theme.css");

test("text-fluid-* は文字色と共存する（文字色が捨てられない）", () => {
  assert.equal(
    cn("bg-primary text-primary-foreground text-fluid-base"),
    "bg-primary text-primary-foreground text-fluid-base",
  );
  assert.equal(cn("text-fluid-xs text-muted-foreground"), "text-fluid-xs text-muted-foreground");
});

test("text-fluid-* と固定サイズ text-* は同じ font-size グループとして後勝ちする", () => {
  assert.equal(cn("text-base text-fluid-xl"), "text-fluid-xl");
  assert.equal(cn("text-fluid-xl text-base"), "text-base");
  assert.equal(cn("text-fluid-sm text-fluid-3xl"), "text-fluid-3xl");
});

test("既存グループの既定挙動は変わらない", () => {
  assert.equal(cn("text-red-500 text-primary"), "text-primary");
  assert.equal(cn("text-sm text-lg"), "text-lg");
  assert.equal(cn("p-2 p-4"), "p-4");
  assert.equal(cn("text-left text-center"), "text-center");
  // clsx の条件付き結合も従来どおり
  assert.equal(cn("a", false && "b", { c: true, d: false }), "a c");
});

test("登録リストは theme.css の --text-fluid-* トークンと一致する（ドリフト検出）", () => {
  const css = readFileSync(themeCssPath, "utf8");
  // `--text-<name>: ...;` のうち line-height 等の修飾子 (`--text-x--line-height`) を除く
  const tokens = [...css.matchAll(/--text-([a-z0-9-]+?):/g)]
    .map((m) => m[1])
    .filter((name) => !name.includes("--"));
  const unique = [...new Set(tokens)];

  assert.ok(unique.length > 0, "theme.css に --text-* トークンが見つからない");
  assert.deepEqual(
    [...unique].sort(),
    [...FLUID_TEXT_SIZES].sort(),
    "theme.css の --text-* と src/lib/cn FLUID_TEXT_SIZES がずれている。両方を更新すること",
  );
});
