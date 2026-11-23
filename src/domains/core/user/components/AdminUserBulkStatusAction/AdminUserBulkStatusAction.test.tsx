// 状態のまとめての変更の一括操作の作成関数(./index.tsx)の検査(jsdom の上で描く。hook・Modal・入力は偽物)。
// - 変える先は BULK_STATUS_TARGETS だけ(退会・仮登録は選べない)
// - 確かめる = hook を dryRun で呼び、変える人・飛ばす人を出す。実行 = dryRun なしで呼び、トーストと onDone
// - 確かめた後に入力を変えると実行が消える。変える先と理由が揃うまで確かめられない。失敗は message を出し onDone しない
// 実行: pnpm test src/domains/core/user/components/AdminUserBulkStatusAction/AdminUserBulkStatusAction.test.tsx
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
mock.module("@/domains/core/user/hooks/useBulkChangeUserStatus", {
  namedExports: {
    useBulkChangeUserStatus: () => ({
      isMutating: false,
      trigger: async (params: { userIds: string[]; dryRun: boolean }) => {
        calls.push(params);
        if (failure) throw failure;
        return {
          dryRun: params.dryRun,
          changed: params.userIds.slice(1).map((userId) => ({ userId, from: "active" })),
          skipped: [{ userId: params.userIds[0], why: "既にその状態" }],
          failed: [],
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
mock.module("@/components/Input/Textarea", {
  namedExports: {
    Textarea: (props: { onChange: (e: { target: { value: string } }) => void }) =>
      createElement("button", { type: "button", onClick: () => props.onChange({ target: { value: "規約違反" } }) }, "type:reason"),
  },
});
mock.module("@/components/Input/Select", {
  namedExports: {
    SelectInput: (props: { id: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) =>
      createElement(
        "span",
        { "data-select": props.id },
        ...props.options.map((o) => createElement("button", { type: "button", key: o.value, onClick: () => props.onChange(o.value) }, `pick:${props.id}:${o.label}`)),
      ),
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

const TARGET = "bulk-user-status-target";
const FROM = "bulk-user-status-from";
const selection = (ids: string[]) => ({ selectedIds: ids, selectedRows: [], selectedKeys: ids, count: ids.length, clear: () => {} });
const render = async (ids: string[]) => {
  const item = creators.bulkUserStatusAction({ key: "userStatus", lists: ["general"], order: 50 });
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

test("変える先は一括で変えてよい状態だけ(退会・仮登録は無い)。0 人なら開けない", async () => {
  const empty = await render([]);
  assert.equal(byText(empty.container, "状態をまとめて変更")?.disabled, true);
  await empty.unmount();
  const view = await render(["u1"]);
  await click(view.container, "状態をまとめて変更");
  const targets = [...view.container.querySelectorAll(`[data-select="${TARGET}"] button`)].map((b) => b.textContent);
  assert.deepEqual(targets, ["有効", "休会中", "処分保留", "永久追放", "セキュリティロック"].map((label) => `pick:${TARGET}:${label}`));
  await view.unmount();
});

test("確かめる = dryRun で呼んで計画を出し、実行 = dryRun なしで呼んでトーストと onDone", async () => {
  const view = await render(["u1", "u2", "u3"]);
  await click(view.container, "状態をまとめて変更");
  assert.equal(byText(view.container, "確かめる")?.disabled, true, "変える先と理由が揃うまで確かめられない");
  await click(view.container, `pick:${TARGET}:処分保留`);
  await click(view.container, `pick:${FROM}:有効`);
  await click(view.container, "type:reason");
  await click(view.container, "確かめる");
  assert.deepEqual(calls, [{ userIds: ["u1", "u2", "u3"], newStatus: "suspended", reason: "規約違反", onlyFrom: "active", dryRun: true }]);
  assert.match(view.container.textContent ?? "", /2 人を「処分保留」に変えます/);
  assert.match(view.container.textContent ?? "", /飛ばす 1 人: 既にその状態/);
  await click(view.container, "実行");
  assert.equal((calls[1] as { dryRun: boolean }).dryRun, false);
  assert.deepEqual(toasts, ["2 人を「処分保留」にしました(飛ばした 1 人)"]);
  assert.deepEqual(events, ["done"]);
  await view.unmount();
});

test("確かめた後に入力を変えると実行が消える。失敗は message を出し onDone しない", async () => {
  const view = await render(["u1", "u2"]);
  await click(view.container, "状態をまとめて変更");
  await click(view.container, `pick:${TARGET}:休会中`);
  await click(view.container, "type:reason");
  await click(view.container, "確かめる");
  assert.ok(byText(view.container, "実行"));
  await click(view.container, `pick:${TARGET}:有効`);
  assert.equal(byText(view.container, "実行"), undefined);
  failure = new Error("管理者のみ操作できます");
  await click(view.container, "確かめる");
  assert.match(view.container.textContent ?? "", /管理者のみ操作できます/);
  assert.deepEqual(events, []);
  await view.unmount();
});
