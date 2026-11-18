// zLayer の名が src/styles/core/z-layer.css(値と class の置き場)と一致することの検査、
// 名の一覧(当議会 D189 の 10)と zLayerClass の形の検査
// 実行: pnpm test src/lib/zLayer
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { Z_LAYER_NAMES, zLayerClass } from "./index";

const css = readFileSync("src/styles/core/z-layer.css", "utf8");

test("z-layer.css の変数の名・値は Z_LAYER_NAMES と同じ順、class は同じ集合", () => {
  const themeBlock = css.slice(css.indexOf("@theme inline"), css.indexOf(":root"));
  const themeNames = [...themeBlock.matchAll(/--z-layer-([a-z-]+):/g)].map((m) => m[1]);
  const rootBlock = css.slice(css.indexOf(":root"), css.indexOf("@layer utilities"));
  const valueNames = [...rootBlock.matchAll(/--z-layer-([a-z-]+):\s*\d+;/g)].map((m) => m[1]);
  const classNames = [...css.matchAll(/\.([a-z-]+)-layer\s*\{/g)].map((m) => m[1]);
  assert.deepEqual(themeNames, [...Z_LAYER_NAMES]);
  assert.deepEqual(valueNames, [...Z_LAYER_NAMES]);
  // utilities の class の並びは CSS の書き順(値の順と違う所がある)なので集合で比べる
  assert.deepEqual([...classNames].sort(), [...Z_LAYER_NAMES].sort());
});

test("値は下から上へ増える(名の並び = 重なりの順)", () => {
  const values = Z_LAYER_NAMES.map((name) => Number(new RegExp(`--z-layer-${name}:\\s*(\\d+);`).exec(css)?.[1]));
  for (let i = 1; i < values.length; i++) assert.ok(values[i] > values[i - 1], `${Z_LAYER_NAMES[i]} > ${Z_LAYER_NAMES[i - 1]}`);
});

test("名は当議会 D189 の 10(ページの層 7 + floating・toast・cover)、zLayerClass は <名>-layer", () => {
  assert.deepEqual(
    [...Z_LAYER_NAMES],
    ["background", "content", "backside-ui", "below-header", "header", "above-header", "forefront", "floating", "toast", "cover"],
  );
  for (const name of Z_LAYER_NAMES) assert.equal(zLayerClass(name), `${name}-layer`);
});
