// 本文の所だけの待ち(PageWait)と、全画面の待ちの最初の描画(D101・D103・D106・D107)
// - PageWait = 流れの中・覆う層なし・背景なし・固定の色なし・文字なし、高さを決める印 data-page-wait を持つ
// - ScreenLoader fullscreen の SSR の最初の HTML はその場に流れの中で出る(mount の後に body 直下で覆うのは globalLoaderParity.test.tsx が見る)
// 実行: pnpm test src/components/Overlays/Loading/PageWait.render.test.tsx
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PageWait } from "./PageWait";
import { ScreenLoader } from "./ScreenLoader";

const classesOf = (html: string) => (/class="([^"]*)"/.exec(html)?.[1] ?? "").split(/\s+/);

test("PageWait は流れの中の印つきの箱で、覆う層・背景・固定の色・文字を持たない", () => {
  const html = renderToStaticMarkup(createElement(PageWait));
  assert.match(html, /^<div data-page-wait=""/);
  const classes = classesOf(html);
  for (const c of classes) assert.doesNotMatch(c, /^(fixed|absolute|inset-|bg-|backdrop-|z-|text-(?!current))/, c);
  assert.equal(html.replace(/<[^>]*>/g, "").trim(), "", "文字を持たない(殻に入る)");
  assert.match(html, /text-current/);
});

test("ScreenLoader fullscreen は SSR の最初の HTML にその場で出る(流れの中、画面の高さ)", () => {
  const html = renderToStaticMarkup(createElement(ScreenLoader, { mode: "fullscreen" }));
  assert.match(html, /role="status"/);
  assert.ok(!classesOf(html).includes("fixed"));
});
