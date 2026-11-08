// 振込レビューの管理一覧の受け口 adminBulkActions の検査。
// - 生成の一覧(extensions/adminBulkActions)に上流の既定の項目 sendEmail がある
// - override で enabled: false にした形(生成器が重ねる)は出ない / fork の項目は order で並ぶ(selectBulkActions の上で)
// - sendEmail の部品は今の一斉送信のボタンを、選んだ id・今の文言・onDone で描く(ボタンは偽物)
// 実行: pnpm test src/features/core/bankTransferReview/hooks/adminBankTransferReviewBulkActions.test.tsx
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";

const buttonProps: Record<string, unknown>[] = [];
mock.module("@/components/BulkSendEmail", {
  namedExports: {
    BulkSendEmailButton: (props: Record<string, unknown>) => {
      buttonProps.push(props);
      return null;
    },
  },
});
const sendEmail = async () => ({ sent: 0 });
mock.module("@/features/core/bankTransferReview/services/client/bankTransferReviewClient", {
  namedExports: { adminBulkSendBankTransferReviewEmail: sendEmail },
});

let adminBulkActions: typeof import("../extensions/adminBulkActions").adminBulkActions;
let selectBulkActions: typeof import("@/lib/tableSuite/BulkActions/selectBulkActions").selectBulkActions;
let renderToStaticMarkup: typeof import("react-dom/server").renderToStaticMarkup;
before(async () => {
  ({ adminBulkActions } = await import("../extensions/adminBulkActions"));
  ({ selectBulkActions } = await import("@/lib/tableSuite/BulkActions/selectBulkActions"));
  ({ renderToStaticMarkup } = await import("react-dom/server"));
});

test("受け口: 上流の既定の項目は sendEmail だけ", () => {
  assert.deepEqual(Object.keys(adminBulkActions), ["sendEmail"]);
  assert.equal(adminBulkActions.sendEmail.order, 100);
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

test("sendEmail: 今の一斉送信のボタンを選んだ id・今の文言・onDone で描く", () => {
  const onDone = () => {};
  const { Component } = adminBulkActions.sendEmail;
  renderToStaticMarkup(
    createElement(Component, {
      selection: { selectedIds: ["r1", "r2"], selectedRows: [], count: 2, clear: () => {} },
      onDone,
    } as never),
  );
  const props = buttonProps.at(-1);
  assert.deepEqual(props?.ids, ["r1", "r2"]);
  assert.equal(props?.onSend, sendEmail);
  assert.equal(props?.onSuccess, onDone);
  assert.equal(props?.recordNoun, "振込レビュー");
  assert.equal(props?.defaultNotificationTitle, "お振込に関するお知らせ");
  assert.equal(
    props?.defaultNotificationBody,
    "お振込のご確認に関する重要なお知らせをメールにて送付しております。\nお手数をおかけいたしますが、ご確認のほどお願いいたします。",
  );
  assert.equal(props?.subjectPlaceholder, "例: お振込内容の確認のお願い");
});
