// 作成関数 bulkMessageAction の検査(ボタンは偽物)。
// - meta(key・order・lists・enabled・access)はそのまま項目に載る
// - 部品は選んだ id・options・onDone(onSuccess)でボタンを描き、選択 0 件か options.disabled で押せない
// 実行: pnpm test src/features/core/messaging/components/AdminBulkSend/bulkMessageAction.test.tsx
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";

const buttonProps: Record<string, unknown>[] = [];
mock.module("@/features/core/messaging/components/AdminBulkSend/AdminBulkSendButton", {
  namedExports: {
    AdminBulkSendButton: (props: Record<string, unknown>) => {
      buttonProps.push(props);
      return null;
    },
  },
});

let bulkMessageAction: typeof import("./index").bulkMessageAction;
let renderToStaticMarkup: typeof import("react-dom/server").renderToStaticMarkup;
before(async () => {
  ({ bulkMessageAction } = await import("./index"));
  ({ renderToStaticMarkup } = await import("react-dom/server"));
});

const selection = (ids: string[]) => ({ selectedIds: ids, selectedRows: [], count: ids.length, clear: () => {} });

test("meta はそのまま項目に載り、部品の名前に key が入る", () => {
  const enabled = () => true;
  const item = bulkMessageAction(
    { key: "notify", order: 20, lists: ["general"], enabled, access: { roles: ["admin"] } },
    { target: "shippingRequest", recordNoun: "発送リクエスト" },
  );
  assert.equal(item.key, "notify");
  assert.equal(item.order, 20);
  assert.deepEqual(item.lists, ["general"]);
  assert.equal(item.enabled, enabled);
  assert.deepEqual(item.access, { roles: ["admin"] });
  assert.equal((item.Component as { displayName?: string }).displayName, "bulkMessageAction(notify)");
});

test("部品は選んだ id・options・onDone でボタンを描く", () => {
  const onDone = () => {};
  const item = bulkMessageAction(
    { key: "notify" },
    { target: "shippingRequest", recordNoun: "発送リクエスト", defaultKind: "transactional", label: "連絡" },
  );
  renderToStaticMarkup(createElement(item.Component, { selection: selection(["a", "b"]), onDone } as never));
  const props = buttonProps.at(-1);
  assert.deepEqual(props?.ids, ["a", "b"]);
  assert.equal(props?.target, "shippingRequest");
  assert.equal(props?.recordNoun, "発送リクエスト");
  assert.equal(props?.defaultKind, "transactional");
  assert.equal(props?.label, "連絡");
  assert.equal(props?.onSuccess, onDone);
  assert.equal(props?.disabled, false);
});

test("選択 0 件か options.disabled なら押せない", () => {
  const item = bulkMessageAction({ key: "notify" }, { target: "t", recordNoun: "記録" });
  renderToStaticMarkup(createElement(item.Component, { selection: selection([]), onDone: () => {} } as never));
  assert.equal(buttonProps.at(-1)?.disabled, true);
  const off = bulkMessageAction({ key: "notify" }, { target: "t", recordNoun: "記録", disabled: true });
  renderToStaticMarkup(createElement(off.Component, { selection: selection(["a"]), onDone: () => {} } as never));
  assert.equal(buttonProps.at(-1)?.disabled, true);
});
