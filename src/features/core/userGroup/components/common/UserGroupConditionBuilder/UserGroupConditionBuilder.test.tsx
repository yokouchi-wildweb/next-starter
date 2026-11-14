// 条件の組み立ての部品の検査(jsdom の上で描く。Button・SelectInput・引数の欄は偽物)。
// - 部品は label で出し鍵は出さない(D94)/ 組を足すのは根だけ(2 段まで)/ 当てはまる ⇄ 当てはまらない / 外す / 条件を足す
// - 読むだけの定義: 合わせ方・not・部品の label と引数(選択肢は label)、「作り直す」
// 実行: pnpm test src/features/core/userGroup/components/common/UserGroupConditionBuilder/UserGroupConditionBuilder.test.tsx
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

const events: string[] = [];
mock.module("@/components/Form/Button", {
  namedExports: {
    Button: (props: { children?: ReactNode; disabled?: boolean; onClick?: () => void }) =>
      createElement("button", { type: "button", disabled: props.disabled, onClick: props.onClick }, props.children as never),
  },
});
mock.module("@/components/Form/Input/Manual", {
  namedExports: {
    SelectInput: (props: { options: { value: string; label: string }[]; onChange: (v: string) => void; placeholder?: string }) =>
      createElement(
        "span",
        { "data-select": props.placeholder ?? "op" },
        ...props.options.map((o) => createElement("button", { type: "button", key: o.value, onClick: () => props.onChange(o.value) }, `pick:${o.label}`)),
      ),
  },
});
mock.module("@/features/core/userGroup/components/common/UserGroupCriterionFields", {
  namedExports: { UserGroupCriterionFields: () => createElement("div", { "data-part": "fields" }) },
});

const CRITERIA = [
  { key: "role", label: "ロール", description: "ロールで絞る", weight: "cheap", weightLabel: "軽い", fields: [] },
  {
    key: "hasTag",
    label: "タグ",
    description: null,
    weight: "heavy",
    weightLabel: "重い(定期計算向け)",
    fields: [{ name: "tagIds", label: "タグ", formInput: "multiSelect", options: [{ value: "t1", label: "常連" }] }],
  },
];
const actions = {
  addCriterion: (groupId: string, part: string) => events.push(`add:${groupId}:${part}`),
  addGroup: (groupId: string) => events.push(`group:${groupId}`),
  remove: (id: string) => events.push(`remove:${id}`),
  setOp: (id: string, op: string) => events.push(`op:${id}:${op}`),
  setNegate: (id: string, negate: boolean) => events.push(`negate:${id}:${negate}`),
  setArgs: () => {},
  reset: () => events.push("reset"),
};
const ROOT = {
  id: "r",
  type: "group",
  op: "and",
  negate: false,
  children: [
    { id: "l1", type: "criterion", part: "role", args: {}, negate: false },
    { id: "g1", type: "group", op: "or", negate: true, children: [{ id: "l2", type: "criterion", part: "hasTag", args: {}, negate: false }] },
  ],
};

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let UserGroupConditionBuilder: typeof import("./index").UserGroupConditionBuilder;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ UserGroupConditionBuilder } = await import("./index"));
});
after(() => dom.window.close());
beforeEach(() => {
  events.length = 0;
});

const render = async (props: Record<string, unknown>) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(UserGroupConditionBuilder, { criteria: CRITERIA, actions, ...props } as never)));
  return { container, unmount: () => act(async () => root.unmount()) };
};
const click = async (container: HTMLElement, text: string, index = 0) => {
  const button = [...container.querySelectorAll("button")].filter((b) => b.textContent === text)[index];
  assert.ok(button, `button ${text}`);
  await act(async () => button.click());
};

test("組める形: label で出し鍵は出さない、組を足すのは根だけ、当てはまらない・外す・足す", async () => {
  const view = await render({ root: ROOT, problems: ["空の組があります"] });
  const text = view.container.textContent ?? "";
  assert.match(text, /ロール/);
  assert.match(text, /重い\(定期計算向け\)/);
  assert.doesNotMatch(text, /hasTag|"role"/);
  assert.match(text, /空の組があります/);
  assert.equal([...view.container.querySelectorAll("button")].filter((b) => b.textContent === "組を足す").length, 1, "2 段目の組には組を足せない");
  assert.equal(view.container.querySelectorAll('[data-part="fields"]').length, 2);
  await click(view.container, "組を足す");
  await click(view.container, "当てはまる人");
  await click(view.container, "当てはまらない人");
  await click(view.container, "組を外す");
  await click(view.container, "pick:ロール"); // 先に描かれるのは 2 段目の組の「条件を足す」
  await click(view.container, "pick:どれか 1 つを満たす");
  assert.deepEqual(events, ["group:r", "negate:r:true", "negate:g1:false", "remove:g1", "add:g1:role", "op:r:or"]);
  await view.unmount();
});

test("読むだけ: 合わせ方・not・部品の label と引数(選択肢は label)、作り直す", async () => {
  const definition = { op: "and", children: [{ op: "or", children: [{ op: "not", child: { part: "hasTag", args: { tagIds: ["t1"] } } }] }, { part: "gone" }] };
  const view = await render({ root: null, readOnlyDefinition: definition, readOnlyNote: "読むだけです" });
  const text = view.container.textContent ?? "";
  assert.match(text, /読むだけです/);
  assert.match(text, /すべて満たす/);
  assert.match(text, /当てはまらない人/);
  assert.match(text, /タグ\(タグ: 常連\)/);
  assert.match(text, /今は使えない条件/);
  assert.doesNotMatch(text, /t1|hasTag|gone/);
  await click(view.container, "作り直す");
  assert.deepEqual(events, ["reset"]);
  await view.unmount();
});
