// 作成関数 bulkMessageAction の検査(送るモーダルは偽物)。
// - meta(key・order・lists・enabled・access)はそのまま項目に載る
// - 部品は送るモーダルを bulk の開き方(target・選んだ id・名詞・既定)で描き、選択 0 件か options.disabled で押せない
// - 送った後は options.onSent(一括の結果)→ onDone(選択の解除・取り直し)
// 実行: pnpm test src/features/core/messaging/components/AdminBulkSend/bulkMessageAction.test.tsx
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";

const modalProps: Record<string, unknown>[] = [];
mock.module("@/features/core/messaging/components/MessageSendModal", {
  namedExports: {
    MessageSendModal: (props: Record<string, unknown>) => {
      modalProps.push(props);
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

test("送るモーダルを bulk で描き、送った後は onSent → onDone", () => {
  const events: string[] = [];
  const item = bulkMessageAction(
    { key: "notify" },
    {
      target: "shippingRequest",
      recordNoun: "発送リクエスト",
      label: "連絡",
      defaultCategory: "operatorDirect",
      defaults: { inAppTitle: "題" },
      onSent: (result) => events.push(`sent:${result.dispatchId}`),
    },
  );
  renderToStaticMarkup(createElement(item.Component, { selection: selection(["a", "b"]), onDone: () => events.push("done") } as never));
  const props = modalProps.at(-1)!;
  assert.deepEqual(props.mode, {
    type: "bulk",
    target: "shippingRequest",
    recordIds: ["a", "b"],
    recordNoun: "発送リクエスト",
    defaults: { inAppTitle: "題" },
    defaultCategory: "operatorDirect",
    source: undefined,
  });
  assert.equal(props.label, "連絡");
  assert.equal(props.disabled, false);
  (props.onSent as (sent: unknown) => void)({ kind: "bulk", result: { dispatchId: "b1" } });
  assert.deepEqual(events, ["sent:b1", "done"]);
});

test("選択 0 件か options.disabled なら押せない", () => {
  const item = bulkMessageAction({ key: "notify" }, { target: "t", recordNoun: "記録" });
  renderToStaticMarkup(createElement(item.Component, { selection: selection([]), onDone: () => {} } as never));
  assert.equal(modalProps.at(-1)?.disabled, true);
  const off = bulkMessageAction({ key: "notify" }, { target: "t", recordNoun: "記録", disabled: true });
  renderToStaticMarkup(createElement(off.Component, { selection: selection(["a"]), onDone: () => {} } as never));
  assert.equal(modalProps.at(-1)?.disabled, true);
});
