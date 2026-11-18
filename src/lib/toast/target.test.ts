// トーストの領域の判定(isToastTarget)の検査
// 実行: pnpm test src/lib/toast/target.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import { isToastTarget, TOAST_REGION_SLOT } from "./target";

test("トーストの領域の中(領域そのもの・子孫)は true、外・null・Element でない物は false", () => {
  const { document } = new JSDOM(
    `<body><div data-slot="${TOAST_REGION_SLOT}"><button id="in">x</button></div><button id="out">y</button></body>`,
  ).window;
  assert.equal(isToastTarget(document.querySelector(`[data-slot="${TOAST_REGION_SLOT}"]`)), true);
  assert.equal(isToastTarget(document.getElementById("in")), true);
  assert.equal(isToastTarget(document.getElementById("out")), false);
  assert.equal(isToastTarget(null), false);
  assert.equal(isToastTarget(undefined), false);
  assert.equal(isToastTarget({} as EventTarget), false);
});
