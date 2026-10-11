// Dialog 内 Popover の「FocusScope フォーカス復帰で閉じない」判定の契約テスト。
// 実行: pnpm test:popover-dismiss （node:test + Node 組み込みの TypeScript type stripping。追加依存なし）
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DIALOG_CONTAINER_SELECTOR,
  isDialogFocusRestoration,
} from "./isDialogFocusRestoration.ts";

// DOM 無しで Element.matches を模す最小スタブ。
// セレクタは `[attr="value"]` の OR リストのみ対応（本番セレクタの形に合わせる）
function stubElement(attrs) {
  return {
    matches(selector) {
      return selector.split(",").some((part) => {
        const m = part.trim().match(/^\[([\w-]+)="([^"]*)"\]$/);
        if (!m) throw new Error(`unsupported selector in test stub: ${part}`);
        return attrs[m[1]] === m[2];
      });
    },
  };
}

const dialogContent = stubElement({ "data-slot": "dialog-content", role: "dialog" });
const roleOnlyDialog = stubElement({ role: "dialog" });
const alertDialog = stubElement({ role: "alertdialog" });
const innerDiv = stubElement({ "data-slot": "dialog-body" });
const overlay = stubElement({ "data-slot": "dialog-overlay" });

test("focusin + Dialog コンテナ自身 → 復帰とみなす（抑止対象）", () => {
  assert.equal(
    isDialogFocusRestoration({ originalEventType: "focusin", target: dialogContent }),
    true
  );
});

test("data-slot 無しでも role=dialog / alertdialog のコンテナは拾う（下流独自 Dialog 対策）", () => {
  assert.equal(
    isDialogFocusRestoration({ originalEventType: "focusin", target: roleOnlyDialog }),
    true
  );
  assert.equal(
    isDialogFocusRestoration({ originalEventType: "focusin", target: alertDialog }),
    true
  );
});

test("focusin でもコンテナの子孫要素なら従来どおり外側扱い（closest ではなく自身一致）", () => {
  assert.equal(
    isDialogFocusRestoration({ originalEventType: "focusin", target: innerDiv }),
    false
  );
  assert.equal(
    isDialogFocusRestoration({ originalEventType: "focusin", target: overlay }),
    false
  );
});

test("pointerdown はコンテナ自身が target でも抑止しない（空のモーダル本体クリックは閉じる）", () => {
  assert.equal(
    isDialogFocusRestoration({ originalEventType: "pointerdown", target: dialogContent }),
    false
  );
});

test("target が null / matches を持たない（Text ノード等）なら false", () => {
  assert.equal(isDialogFocusRestoration({ originalEventType: "focusin", target: null }), false);
  assert.equal(
    isDialogFocusRestoration({ originalEventType: "focusin", target: { nodeType: 3 } }),
    false
  );
});

test("セレクタは shadcn の data-slot と Radix の role の両方を含む", () => {
  assert.match(DIALOG_CONTAINER_SELECTOR, /\[data-slot="dialog-content"\]/);
  assert.match(DIALOG_CONTAINER_SELECTOR, /\[role="dialog"\]/);
  assert.match(DIALOG_CONTAINER_SELECTOR, /\[role="alertdialog"\]/);
});
