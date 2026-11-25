// ScreenLoader の層と押しの受け止め(注文 16)
// - fullscreen = 最初の描画はその場の流れの中、mount の後は body 直下の cover の層 + pointer-events-auto(globalLoaderParity.test.tsx)
// - local = 頁の中の覆い(backside-ui)、pointer-events はそのまま
// 実行: pnpm test src/components/Overlays/Loading/ScreenLoader.render.test.tsx
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ScreenLoader } from "./ScreenLoader";

const classesOf = (html: string) => (/class="([^"]*)"/.exec(html)?.[1] ?? "").split(/\s+/);

test("fullscreen の最初の描画(SSR)はその場の流れの中で画面の高さ、local は頁の中の覆いのまま", () => {
  // mount の後に body 直下で cover の層・押しの受け止めになるのは globalLoaderParity.test.tsx が jsdom で見る
  const full = classesOf(renderToStaticMarkup(createElement(ScreenLoader, { mode: "fullscreen" })));
  assert.ok(!full.includes("fixed") && full.includes("min-h-[var(--viewport-height,100dvh)]"), full.join(" "));
  const local = classesOf(renderToStaticMarkup(createElement(ScreenLoader, { mode: "local" })));
  assert.ok(local.includes("backside-ui-layer") && !local.includes("pointer-events-auto"), local.join(" "));
});
