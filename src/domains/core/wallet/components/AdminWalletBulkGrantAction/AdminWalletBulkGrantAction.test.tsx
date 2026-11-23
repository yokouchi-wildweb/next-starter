// まとめての付与の一括操作の作成関数(./index.tsx)の検査(jsdom の上で描く。hook・Modal・入力は偽物)。
// - 確かめる = hook を dryRun で呼び、付ける人数・合計・飛ばす人を出す。実行 = dryRun なしで呼び、トーストと onDone
// - 確かめた後に入力を変えると実行が消える(新しい確かめの後だけ実行)。入力が揃うまで確かめられない。0 人なら開けない
// - 失敗はその message を出し、onDone しない
// 実行: pnpm test src/domains/core/wallet/components/AdminWalletBulkGrantAction/AdminWalletBulkGrantAction.test.tsx
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactNode } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.MouseEvent = dom.window.MouseEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;

const calls: unknown[] = [];
const events: string[] = [];
const toasts: string[] = [];
let failure: Error | null = null;
mock.module("@/lib/toast", { namedExports: { useToast: () => ({ showToast: (message: string) => void toasts.push(message) }) } });
mock.module("@/domains/wallet/config", { namedExports: { walletConfig: { currency: { point: { label: "ポイント" }, coin: { label: "コイン" } } } } });
mock.module("@/domains/core/wallet/hooks/useBulkGrantWallet", {
  namedExports: {
    useBulkGrantWallet: () => ({
      isMutating: false,
      trigger: async (params: { grants: { userId: string; amount: number }[]; dryRun: boolean }) => {
        calls.push(params);
        if (failure) throw failure;
        return {
          dryRun: params.dryRun,
          requestBatchIds: params.dryRun ? [] : ["b1"],
          granted: params.grants.slice(1),
          skipped: [{ userId: params.grants[0].userId, why: "削除済み" }],
          total: params.grants.slice(1).reduce((sum, row) => sum + row.amount, 0),
          notified: 0,
          notifyFailed: [],
        };
      },
    }),
  },
});
mock.module("@/components/Overlays/Modal", {
  defaultExport: (props: { open: boolean; children?: ReactNode; footer?: ReactNode }) =>
    props.open ? createElement("section", { "data-testid": "modal" }, props.children as never, props.footer as never) : null,
});
mock.module("@/components/Button/Button", {
  namedExports: {
    Button: (props: { children?: ReactNode; disabled?: boolean; onClick?: () => void }) =>
      createElement("button", { type: "button", disabled: props.disabled, onClick: props.onClick }, props.children as never),
  },
});
// 入力の偽物: 押すと決まった値を入れるボタン
const typer = (name: string, value: string) => {
  const Typer = (props: { onChange: (e: { target: { value: string } }) => void }) =>
    createElement("button", { type: "button", onClick: () => props.onChange({ target: { value } }) }, `type:${name}`);
  Typer.displayName = `Typer(${name})`;
  return Typer;
};
mock.module("@/components/Input/Input", { namedExports: { Input: typer("amount", "100") } });
mock.module("@/components/Input/Textarea", { namedExports: { Textarea: typer("reason", "障害のお詫び") } });
mock.module("@/components/Input/BooleanCheckboxInput", {
  namedExports: { BooleanCheckboxInput: (props: { onChange: (v: boolean) => void }) => createElement("button", { type: "button", onClick: () => props.onChange(true) }, "type:notify") },
});
mock.module("@/components/Input/Select", {
  namedExports: {
    SelectInput: (props: { options: { value: string; label: string }[]; onChange: (v: string) => void }) =>
      createElement("span", null, ...props.options.map((o) => createElement("button", { type: "button", key: o.value, onClick: () => props.onChange(o.value) }, `pick:${o.label}`))),
  },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let creators: typeof import("./index");
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  creators = await import("./index");
});
after(() => dom.window.close());
beforeEach(() => {
  calls.length = 0;
  events.length = 0;
  toasts.length = 0;
  failure = null;
});

const selection = (ids: string[]) => ({ selectedIds: ids, selectedRows: [], selectedKeys: ids, count: ids.length, clear: () => {} });
const render = async (ids: string[]) => {
  const item = creators.bulkWalletGrantAction({ key: "walletGrant", lists: ["general"], order: 40 });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(item.Component as never, { selection: selection(ids), onDone: () => events.push("done") } as never)));
  return { item, container, unmount: () => act(async () => root.unmount()) };
};
const byText = (container: HTMLElement, text: string) => [...container.querySelectorAll("button")].find((b) => b.textContent === text);
const click = async (container: HTMLElement, text: string) => {
  const button = byText(container, text);
  assert.ok(button, `button ${text}`);
  await act(async () => button.click());
};
const fill = async (container: HTMLElement) => {
  await click(container, "type:amount");
  await click(container, "type:reason");
};

test("項目の形: meta をそのまま持ち、既定の題で開く。0 人なら開けない", async () => {
  const empty = await render([]);
  assert.deepEqual([empty.item.key, empty.item.lists, empty.item.order], ["walletGrant", ["general"], 40]);
  assert.equal(byText(empty.container, "まとめて付与")?.disabled, true);
  await empty.unmount();
});

test("確かめる = dryRun で呼んで計画を出し、実行 = dryRun なしで呼んでトーストと onDone", async () => {
  const view = await render(["u1", "u2", "u3"]);
  await click(view.container, "まとめて付与");
  assert.equal(byText(view.container, "確かめる")?.disabled, true, "額と理由が揃うまで確かめられない");
  await click(view.container, "pick:お詫び・補填");
  await click(view.container, "type:notify");
  await fill(view.container);
  await click(view.container, "確かめる");
  assert.deepEqual(calls, [
    {
      walletType: "point",
      kind: "compensation",
      grants: [
        { userId: "u1", amount: 100 },
        { userId: "u2", amount: 100 },
        { userId: "u3", amount: 100 },
      ],
      reason: "障害のお詫び",
      notify: true,
      dryRun: true,
    },
  ]);
  assert.match(view.container.textContent ?? "", /ポイントを 2 人に付けます\(合計 200\)/);
  assert.match(view.container.textContent ?? "", /飛ばす 1 人: 削除済み/);
  await click(view.container, "実行");
  assert.equal((calls[1] as { dryRun: boolean }).dryRun, false);
  assert.deepEqual(toasts, ["ポイントを 2 人に付けました(合計 200、飛ばした 1 人)"]);
  assert.deepEqual(events, ["done"]);
  await view.unmount();
});

test("確かめた後に入力を変えると実行が消える", async () => {
  const view = await render(["u1", "u2"]);
  await click(view.container, "まとめて付与");
  await fill(view.container);
  await click(view.container, "確かめる");
  assert.ok(byText(view.container, "実行"));
  await click(view.container, "pick:コイン");
  assert.equal(byText(view.container, "実行"), undefined, "確かめ直すまで実行できない");
  await view.unmount();
});

test("失敗はその message を出し、onDone しない", async () => {
  failure = new Error("1 回に付けられるのは 1000 人までです(2 束のうち 1 束まで済み)");
  const view = await render(["u1", "u2"]);
  await click(view.container, "まとめて付与");
  await fill(view.container);
  await click(view.container, "確かめる");
  assert.match(view.container.textContent ?? "", /2 束のうち 1 束まで済み/);
  assert.deepEqual(events, []);
  await view.unmount();
});
