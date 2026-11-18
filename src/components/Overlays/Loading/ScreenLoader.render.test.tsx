// ScreenLoader の層と押しの受け止め(注文 16)
// - fullscreen = cover の層 + pointer-events-auto(モーダルが開いていても下の物を押させない)
// - local = 頁の中の覆い(backside-ui)、pointer-events はそのまま
// 実行: pnpm test src/components/Overlays/Loading/ScreenLoader.render.test.tsx
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ScreenLoader } from "./ScreenLoader";

const classesOf = (html: string) => (/class="([^"]*)"/.exec(html)?.[1] ?? "").split(/\s+/);

test("fullscreen は cover の層で押しを受け止め、local は頁の中の覆いのまま", () => {
  const full = classesOf(renderToStaticMarkup(createElement(ScreenLoader, { mode: "fullscreen" })));
  assert.ok(full.includes("cover-layer") && full.includes("pointer-events-auto"), full.join(" "));
  const local = classesOf(renderToStaticMarkup(createElement(ScreenLoader, { mode: "local" })));
  assert.ok(local.includes("backside-ui-layer") && !local.includes("pointer-events-auto"), local.join(" "));
});
