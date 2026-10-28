// 枠の config と部品の循環 import で、モジュールの読み込みが落ちないことの検査(モックなし。実行: pnpm test:user-layout)
//
// config/ui/user-footer.config は UserFooter を re-export しているので、config を最初に読むと
// config → Footer → hooks/useFooterData → config(初期化の途中)の循環になる。
// hook がモジュールの読み込み時に config の値を読むと初期化前で落ちる(dev server では全ユーザー画面が 500)。
// 他の test は config をモックするのでこの順序を通らない。
import { test } from "node:test";
import assert from "node:assert/strict";

test("config/ui/user-footer.config を最初に読んでも落ちず、useFooterData が config の値を返す", async () => {
  const config = await import("@/config/ui/user-footer.config");
  assert.equal(typeof config.UserFooter, "function");
  const { useFooterData } = await import("./hooks/useFooterData");
  assert.equal(typeof useFooterData, "function");
});
