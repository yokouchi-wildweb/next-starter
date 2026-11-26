// 振込レビューの管理一覧の一括操作(点 adminBulkActions の bankTransferReview の項目)の検査。
// - 生成の一覧(core/admin の extensions/adminBulkActions)に上流の既定の項目 sendEmail がある
// - override で enabled: false にした形(生成器が重ねる)は出ない / fork の項目は order で並ぶ(selectBulkActions の上で)
// - sendEmail は連絡の作成関数 definitionBulkAction の項目で、定義連絡の汎用の送るモーダルを記録の入口(項目の鍵・選んだ id。目的の props は無い、D164 D194)で描き、
//   送った後に onDone(モーダルは偽物)。自由連絡の一括送信は残っていない
// 実行: pnpm test src/domains/core/bankTransferReview/hooks/adminBankTransferReviewBulkActions.test.tsx
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";

const buttonProps: Record<string, unknown>[] = [];
// 作成関数の中の部品(定義連絡の汎用の送るモーダル DefinitionSendModal)を偽物にして、渡す props を見る
mock.module("@/domains/core/messaging/components/DefinitionSendModal", {
  namedExports: {
    DefinitionSendModal: (props: Record<string, unknown>) => {
      buttonProps.push(props);
      return null;
    },
  },
});

let adminBulkActions: Record<string, import("../types/bankTransferReviewAdminBulkAction").BankTransferReviewAdminBulkActionItem>;
let selectBulkActions: typeof import("@/lib/tableSuite").selectBulkActions;
let renderToStaticMarkup: typeof import("react-dom/server").renderToStaticMarkup;
before(async () => {
  const { adminBulkActions: all } = await import("@/domains/core/admin/extensions/adminBulkActions");
  adminBulkActions = Object.fromEntries(all.filter((entry) => entry.domain === "bankTransferReview").map((entry) => [entry.plug.key, entry.plug as import("../types/bankTransferReviewAdminBulkAction").BankTransferReviewAdminBulkActionItem]));
  ({ selectBulkActions } = await import("@/lib/tableSuite"));
  ({ renderToStaticMarkup } = await import("react-dom/server"));
});

test("受け口: 上流の既定の項目 sendEmail がある(order 100)。上流の項目が sendEmail だけなのは Tier1 で確かめる", async () => {
  assert.equal(adminBulkActions.sendEmail.order, 100);
  const { readForkIdentity } = await import("@/lib/forkOwnership/node.mjs");
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

test("sendEmail: 定義連絡の汎用のモーダルを記録の入口 bankTransferReview.reviews・選んだ id・今の文言・onDone で描く", () => {
  const { Component } = adminBulkActions.sendEmail;
  renderToStaticMarkup(
    createElement(Component, {
      selection: { selectedIds: ["r1", "r2"], selectedRows: [], count: 2, clear: () => {} },
      onDone: () => {},
    } as never),
  );
  const props = buttonProps.at(-1);
  // 入口は項目の鍵と選んだ id だけ(送る連絡定義は項目の messages から選ぶ。目的の props は無い、D164)
  assert.deepEqual(props?.entry, { type: "records", recordTarget: "bankTransferReview.reviews", recordIds: ["r1", "r2"] });
  assert.equal("mode" in (props ?? {}), false, "自由連絡の送るモーダルの開き方は渡さない");
  assert.equal(props?.label, "確認の連絡を送る");
  assert.equal(props?.disabled, false);
  let done = 0;
  renderToStaticMarkup(
    createElement(Component, {
      selection: { selectedIds: ["r1"], selectedRows: [], count: 1, clear: () => {} },
      onDone: () => (done += 1),
    } as never),
  );
  (buttonProps.at(-1)?.onSent as (result: unknown) => void)({ dispatchId: "d1", status: "queued", afterSend: { ok: true } });
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
