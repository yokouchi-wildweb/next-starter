// 振込レビューの管理一覧の受け口 adminBulkActions の検査。
// - 生成の一覧(extensions/adminBulkActions)に上流の既定の項目 sendEmail がある
// - override で enabled: false にした形(生成器が重ねる)は出ない / fork の項目は order で並ぶ(selectBulkActions の上で)
// - sendEmail は連絡の作成関数 bulkMessageAction の項目で、送るモーダルを bulk(target・選んだ id・今の文言)で描き、送った後に onDone(モーダルは偽物)
// 実行: pnpm test src/features/core/bankTransferReview/hooks/adminBankTransferReviewBulkActions.test.tsx
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";

const buttonProps: Record<string, unknown>[] = [];
// 作成関数の中の部品(送るモーダル MessageSendModal)を偽物にして、渡す props を見る
mock.module("@/features/core/messaging/components/MessageSendModal", {
  namedExports: {
    MessageSendModal: (props: Record<string, unknown>) => {
      buttonProps.push(props);
      return null;
    },
  },
});

let adminBulkActions: typeof import("../extensions/adminBulkActions").adminBulkActions;
let selectBulkActions: typeof import("@/lib/tableSuite/BulkActions/selectBulkActions").selectBulkActions;
let renderToStaticMarkup: typeof import("react-dom/server").renderToStaticMarkup;
before(async () => {
  ({ adminBulkActions } = await import("../extensions/adminBulkActions"));
  ({ selectBulkActions } = await import("@/lib/tableSuite/BulkActions/selectBulkActions"));
  ({ renderToStaticMarkup } = await import("react-dom/server"));
});

test("受け口: 上流の既定の項目 sendEmail がある(order 100)。上流の項目が sendEmail だけなのは Tier1 で確かめる", async () => {
  assert.equal(adminBulkActions.sendEmail.order, 100);
  const { readForkIdentity } = await import("@/lib/forkOwnership/forkIds.mjs");
  const { join } = await import("node:path");
  // fork は受け口に自分の項目を足せる(notice admin-screen-hooks の手順 3)ので、一覧が sendEmail だけなのは Tier1 だけの前提
  if (readForkIdentity(join(__dirname, "../../../../..")).isTier1) {
    assert.deepEqual(Object.keys(adminBulkActions), ["sendEmail"]);
  }
});

test("受け口: override で enabled: false の既定は出ず、fork の項目は order で並ぶ", () => {
  const upstream = adminBulkActions.sendEmail;
  const forkItem = { key: "bulkApprove", order: 10, Component: () => null };
  assert.deepEqual(
    selectBulkActions([upstream, forkItem]).map((item) => item.key),
    ["bulkApprove", "sendEmail"],
  );
  assert.deepEqual(
    selectBulkActions([{ ...upstream, enabled: false }, forkItem]).map((item) => item.key),
    ["bulkApprove"],
  );
});

test("sendEmail: 連絡の一括送信のボタンを target bankTransferReview・選んだ id・今の文言・onDone で描く", () => {
  const onDone = () => {};
  const { Component } = adminBulkActions.sendEmail;
  renderToStaticMarkup(
    createElement(Component, {
      selection: { selectedIds: ["r1", "r2"], selectedRows: [], count: 2, clear: () => {} },
      onDone,
    } as never),
  );
  const props = buttonProps.at(-1);
  const mode = props?.mode as Record<string, unknown>;
  assert.equal(mode.type, "bulk");
  assert.deepEqual(mode.recordIds, ["r1", "r2"]);
  assert.equal(mode.target, "bankTransferReview");
  assert.equal(mode.recordNoun, "振込レビュー");
  assert.equal(mode.defaultCategory, "operatorDirect");
  assert.deepEqual(mode.defaults, {
    inAppTitle: "お振込に関するお知らせ",
    inAppBody:
      "お振込のご確認に関する重要なお知らせをメールにて送付しております。\nお手数をおかけいたしますが、ご確認のほどお願いいたします。",
  });
  assert.equal(props?.label, "メール一斉送信");
  assert.equal(props?.disabled, false);
  let done = 0;
  const onDoneProbe = () => (done += 1);
  renderToStaticMarkup(
    createElement(Component, {
      selection: { selectedIds: ["r1"], selectedRows: [], count: 1, clear: () => {} },
      onDone: onDoneProbe,
    } as never),
  );
  (buttonProps.at(-1)?.onSent as (sent: unknown) => void)({ kind: "bulk", result: { dispatchId: "b1" } });
  assert.equal(done, 1, "送った後に onDone");
});

test("sendEmail: 選択が 0 件ならボタンは押せない", () => {
  const { Component } = adminBulkActions.sendEmail;
  renderToStaticMarkup(
    createElement(Component, {
      selection: { selectedIds: [], selectedRows: [], count: 0, clear: () => {} },
      onDone: () => {},
    } as never),
  );
  assert.equal(buttonProps.at(-1)?.disabled, true);
});
