// 作成関数 definitionBulkAction の検査(汎用の送るモーダルは偽物)。
// - meta はそのまま項目に載る
// - 部品は汎用のモーダルを記録の入口(recordTarget・選んだ id。目的の props は無い、D164)で描き、選択 0 件か options.disabled で押せない
// - 送った後は options.onSent(結果)→ onDone(選択の解除・取り直し)
// 実行: pnpm test src/domains/core/messaging/components/DefinitionBulkAction/definitionBulkAction.test.tsx
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";

const modalProps: Record<string, unknown>[] = [];
mock.module("@/domains/core/messaging/components/DefinitionSendModal", {
  namedExports: {
    DefinitionSendModal: (props: Record<string, unknown>) => {
      modalProps.push(props);
      return null;
    },
  },
});

let definitionBulkAction: typeof import("./index").definitionBulkAction;
let renderToStaticMarkup: typeof import("react-dom/server").renderToStaticMarkup;
before(async () => {
  ({ definitionBulkAction } = await import("./index"));
  ({ renderToStaticMarkup } = await import("react-dom/server"));
});

const selection = (ids: string[]) => ({ selectedIds: ids, selectedRows: [], count: ids.length, clear: () => {} });

test("meta はそのまま項目に載り、部品の名前に key が入る", () => {
  const enabled = () => true;
  const item = definitionBulkAction({ key: "sendEmail", order: 10, lists: ["general"], enabled }, { recordTarget: "bankTransferReview.reviews" });
  assert.equal(item.key, "sendEmail");
  assert.equal(item.order, 10);
  assert.deepEqual(item.lists, ["general"]);
  assert.equal(item.enabled, enabled);
  assert.equal((item.Component as { displayName?: string }).displayName, "definitionBulkAction(sendEmail)");
});

test("汎用のモーダルを記録の入口で描き、送った後は onSent → onDone", () => {
  const events: string[] = [];
  const item = definitionBulkAction(
    { key: "sendEmail" },
    { recordTarget: "bankTransferReview.reviews", label: "メール送信", onSent: (result) => events.push(`sent:${result.dispatchId}`) },
  );
  renderToStaticMarkup(createElement(item.Component, { selection: selection(["a", "b"]), onDone: () => events.push("done") } as never));
  const props = modalProps.at(-1)!;
  assert.deepEqual(props.entry, { type: "records", recordTarget: "bankTransferReview.reviews", recordIds: ["a", "b"] });
  assert.equal(props.label, "メール送信");
  assert.equal(props.disabled, false);
  (props.onSent as (result: unknown) => void)({ dispatchId: "d1" });
  assert.deepEqual(events, ["sent:d1", "done"]);
});

test("選択 0 件か options.disabled なら押せない", () => {
  const item = definitionBulkAction({ key: "x" }, { recordTarget: "t.r" });
  renderToStaticMarkup(createElement(item.Component, { selection: selection([]), onDone: () => {} } as never));
  assert.equal(modalProps.at(-1)?.disabled, true);
  const off = definitionBulkAction({ key: "x" }, { recordTarget: "t.r", disabled: true });
  renderToStaticMarkup(createElement(off.Component, { selection: selection(["a"]), onDone: () => {} } as never));
  assert.equal(modalProps.at(-1)?.disabled, true);
});
