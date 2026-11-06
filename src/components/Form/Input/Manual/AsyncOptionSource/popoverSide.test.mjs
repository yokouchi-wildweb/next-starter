// ピッカー系ポップオーバーの「開く向き」判定の契約テスト。
// 実行: pnpm test src/components/Form/Input/Manual/AsyncOptionSource/popoverSide.test.mjs （node:test + Node 組み込みの TypeScript type stripping。追加依存なし）
import { test } from "node:test";
import assert from "node:assert/strict";

import { decidePopoverSide, POPOVER_SIDE_MARGIN } from "./popoverSide.ts";

const VIEWPORT = 800;
const PREFERRED = 380;

test("下に十分な空きがあれば下に開く", () => {
  assert.equal(
    decidePopoverSide({ anchorTop: 100, anchorBottom: 140, viewportHeight: VIEWPORT, preferredHeight: PREFERRED }),
    "bottom",
  );
});

test("下が足りず上の方が広ければ上に開く（画面下部のトリガー）", () => {
  assert.equal(
    decidePopoverSide({ anchorTop: 600, anchorBottom: 640, viewportHeight: VIEWPORT, preferredHeight: PREFERRED }),
    "top",
  );
});

test("下が足りなくても上の方が狭ければ下のまま", () => {
  // 低いビューポート: 上 88 - 12 = 76、下 300 - 140 - 12 = 148
  assert.equal(
    decidePopoverSide({ anchorTop: 88, anchorBottom: 140, viewportHeight: 300, preferredHeight: PREFERRED }),
    "bottom",
  );
});

test("下の空きがちょうど preferredHeight なら下に開く（境界）", () => {
  // 下の空き = 800 - 408 - 12 = 380、上の空き = 400 - 12 = 388（上の方が広い）
  const anchorBottom = VIEWPORT - PREFERRED - POPOVER_SIDE_MARGIN;
  assert.equal(
    decidePopoverSide({ anchorTop: 400, anchorBottom, viewportHeight: VIEWPORT, preferredHeight: PREFERRED }),
    "bottom",
  );
  // 1px 足りなくなった時点で上へ
  assert.equal(
    decidePopoverSide({ anchorTop: 401, anchorBottom: anchorBottom + 1, viewportHeight: VIEWPORT, preferredHeight: PREFERRED }),
    "top",
  );
});

test("上下が同じ広さなら下のまま", () => {
  assert.equal(
    decidePopoverSide({ anchorTop: 380, anchorBottom: 420, viewportHeight: VIEWPORT, preferredHeight: PREFERRED, margin: 0 }),
    "bottom",
  );
});
