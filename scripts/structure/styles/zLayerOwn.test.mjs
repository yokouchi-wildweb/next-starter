// scripts/structure/styles/zLayerOwn.test.mjs — fork が足す自分の層の検証と値の割り付け
// 実行: pnpm test scripts/structure/styles/zLayerOwn.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { assignOwnLayers, parseUpstreamLayers, renderOwnLayerCss, renderOwnLayersTs } from "./zLayerOwn.mjs";

const upstream = parseUpstreamLayers(readFileSync("src/styles/core/z-layer.css", "utf8"));
const pageNames = ["background", "content", "backside-ui", "below-header", "header", "above-header", "forefront"];
const run = (decls, forkCss = []) => assignOwnLayers({ upstream, pageNames, decls, forkCss });

test("上流の層を z-layer.css の :root から読む(10、下から上)", () => {
  assert.deepEqual(upstream.map((l) => l.name), [...pageNames, "floating", "toast", "cover"]);
  assert.equal(upstream.find((l) => l.name === "floating").value, 800);
});

test("値: above の上の帯に書いた順で +10 ずつ積む、自分の層の上にも積める、空なら何も無い", () => {
  assert.deepEqual(run([]), { ok: true, layers: [] });
  const r = run([
    { name: "game-effect", above: "forefront" },
    { name: "game-hud", above: "game-effect" },
    { name: "ticker", above: "header" },
    { name: "game-flash", above: "forefront" },
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(
    r.layers.map((l) => [l.name, l.value]),
    [["ticker", 370], ["game-effect", 570], ["game-hud", 580], ["game-flash", 590]],
  );
});

test("失敗: above が floating 以上・知らない名・後に書く自分の層、名の誤り・重なり・重複", () => {
  const r = run([
    { name: "over-modal", above: "floating" },
    { name: "x", above: "nowhere" },
    { name: "a", above: "b" },
    { name: "b", above: "forefront" },
    { name: "Bad_Name", above: "forefront" },
    { name: "header", above: "content" },
    { name: "b", above: "forefront" },
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 6);
  assert.match(r.errors[0], /floating はページの層でない/);
  assert.match(r.errors[1], /nowhere という層は無い/);
  assert.match(r.errors[2], /b は後に書いた自分の層/);
  assert.match(r.errors[3], /kebab-case/);
  assert.match(r.errors[4], /上流の層の名と同じ/);
  assert.match(r.errors[5], /同じ名が 2 度/);
});

test("失敗: 帯に入りきらない(header 360 と above-header 390 の間は 2 つまで)", () => {
  const r = run([
    { name: "h1", above: "header" },
    { name: "h2", above: "header" },
    { name: "h3", above: "header" },
  ]);
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /layers\[2\] "h3": header\(360\)の上の帯\(390 の手前まで\)に入りきらない/);
});

test("失敗: fork の CSS が上流の層の値を定義している(自分の層の変数は通す)", () => {
  const r = run([{ name: "game-effect", above: "forefront" }], [
    { file: "src/styles/overrides.css", css: ":root { --z-layer-floating: 9999; --z-layer-game-effect: 1; }" },
  ]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors.length, 1);
  assert.match(r.errors[0], /src\/styles\/overrides.css: 上流の層の値 --z-layer-floating/);
});

test("生成物: CSS は :root の変数と .<名>-layer、TS は名と above の一覧(空なら空)", () => {
  const { layers } = run([{ name: "game-effect", above: "forefront" }]);
  const css = renderOwnLayerCss(layers);
  assert.match(css, /--z-layer-game-effect: 570; \/\* above forefront \*\//);
  assert.match(css, /\.game-effect-layer \{\n    z-index: var\(--z-layer-game-effect\);/);
  assert.match(renderOwnLayersTs(layers), /\{ name: "game-effect", above: "forefront" \},/);
  assert.match(renderOwnLayerCss([]), /自分の層は無い/);
  assert.match(renderOwnLayersTs([]), /export const OWN_LAYERS = \[\] as const/);
});
