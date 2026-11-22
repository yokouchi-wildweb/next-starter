// 条件の組み立ての部品を偽物なしで描く検査(本物の FieldRenderer・入力・上流の条件の部品の欄、jsdom の上)。
// - 足したばかりの条件(引数が空)と保存した木(2 段・not)の両方を、フォームの文脈の誤りなく描ける(前は条件の欄で画面ごと落ちた)
// 実行: pnpm test src/domains/core/userGroup/components/common/UserGroupConditionBuilder/UserGroupConditionBuilder.real.test.tsx
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
// 欄の部品が instanceof で見る DOM の型(HTMLFormElement など)を全部 global に
for (const name of Object.getOwnPropertyNames(dom.window)) {
  if (/^(HTML|SVG)\w*Element$|^(DocumentFragment|Text|Comment|CustomEvent|FocusEvent|PointerEvent|InputEvent|MutationObserver|DOMRect|Range|Selection|NodeList|navigator)$/.test(name) && !(name in globalThis)) g[name] = (dom.window as unknown as Record<string, unknown>)[name];
}
g.Node = dom.window.Node;
g.Element = dom.window.Element;
g.Event = dom.window.Event;
g.MouseEvent = dom.window.MouseEvent;
g.KeyboardEvent = dom.window.KeyboardEvent;
g.getComputedStyle = dom.window.getComputedStyle;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
g.IntersectionObserver = g.ResizeObserver;

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let UserGroupConditionBuilder: typeof import("./index").UserGroupConditionBuilder;
let conditionFromDefinition: typeof import("../../../hooks/useUserGroupConditionBuilder").conditionFromDefinition;
let catalog: { key: string; label: string; description: string | null; weight: string; weightLabel: string; fields: unknown[] }[];
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ UserGroupConditionBuilder } = await import("./index"));
  ({ conditionFromDefinition } = await import("../../../hooks/useUserGroupConditionBuilder"));
  const parts = [
    (await import("../../../criteria/signupPeriod")).criterion,
    (await import("../../../criteria/hasTag")).criterion,
  ];
  catalog = parts.map((c) => ({ key: c.key, label: c.label, description: c.description ?? null, weight: c.weight, weightLabel: "軽い", fields: [...c.fields] }));
});
after(() => dom.window.close());

const noop = () => {};
const actions = { addCriterion: noop, addGroup: noop, remove: noop, setOp: noop, setNegate: noop, setArgs: noop, reset: noop };

const renderRoot = async (definition: unknown) => {
  const errors: unknown[] = [];
  const original = console.error;
  console.error = (...items: unknown[]) => void errors.push(items);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    const draft = conditionFromDefinition(definition as never);
    await act(async () => root.render(createElement(UserGroupConditionBuilder, { root: draft, criteria: catalog as never, actions })));
  } finally {
    console.error = original;
  }
  return { container, errors, unmount: () => act(async () => root.unmount()) };
};

test("足したばかりの条件(引数が空)を描ける", async () => {
  const view = await renderRoot({ op: "and", children: [{ part: "hasTag", args: {} }] });
  assert.deepEqual(view.errors, []);
  assert.equal(view.container.querySelectorAll('[data-slot="user-group-criterion-fields"]').length, 1);
  await view.unmount();
});

test("保存した木(2 段・not・引数つき)を描ける", async () => {
  const view = await renderRoot({
    op: "or",
    children: [
      { part: "signupPeriod", args: { withinDays: 7 } },
      { op: "not", child: { op: "and", children: [{ part: "signupPeriod", args: { withinDays: 30 } }, { part: "hasTag", args: { tagIds: [], match: "all" } }] } },
    ],
  });
  assert.deepEqual(view.errors, []);
  assert.equal(view.container.querySelectorAll('[data-slot="user-group-criterion-fields"]').length, 3);
  await view.unmount();
});
