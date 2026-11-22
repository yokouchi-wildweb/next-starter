// 条件 1 つの引数の欄の検査(偽物なし: 本物の FieldRenderer と上流の条件の部品の欄を jsdom の上で描く)。
// - 上流の部品(状態・登録の時期・最後のログインの時期・タグ・静的グループの一員)の欄が、フォームの文脈の誤りなく描ける
//   (FieldRenderer の FormLabel は react-hook-form の文脈を読む。前は文脈が無く、条件を足すと画面ごと落ちた)
// - 欄を書き換えると onChange に整えた引数(数は数、空の欄は落とす)
// 実行: pnpm test src/domains/core/userGroup/components/common/UserGroupCriterionFields/UserGroupCriterionFields.test.tsx
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
let UserGroupCriterionFields: typeof import("./index").UserGroupCriterionFields;
let criteria: { key: string; fields: readonly unknown[] }[];
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ UserGroupCriterionFields } = await import("./index"));
  criteria = [
    (await import("@/domains/core/userGroup/plugs/userGroupCriteria/signupPeriod")).criterion,
    (await import("@/domains/core/userGroup/plugs/userGroupCriteria/lastLoginPeriod")).criterion,
    (await import("@/domains/core/userGroup/plugs/userGroupCriteria/hasTag")).criterion,
    (await import("@/domains/core/userGroup/plugs/userGroupCriteria/inStaticGroup")).criterion,
  ];
});
after(() => dom.window.close());

const render = async (fields: readonly unknown[], args: Record<string, unknown>, onChange: (args: Record<string, unknown>) => void) => {
  const errors: unknown[] = [];
  const original = console.error;
  console.error = (...items: unknown[]) => void errors.push(items);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(UserGroupCriterionFields, { fields: fields as never, args, onChange })));
  } finally {
    console.error = original;
  }
  return { container, errors, unmount: () => act(async () => root.unmount()) };
};

test("上流の部品の欄はフォームの文脈の誤りなく描ける(新しい条件・保存した引数)", async () => {
  for (const criterion of criteria) {
    for (const args of [{}, criterion.key === "status" ? { statuses: ["active"] } : criterion.key === "signupPeriod" ? { withinDays: 30 } : {}]) {
      const view = await render(criterion.fields, args, () => {});
      assert.deepEqual(view.errors, [], `${criterion.key} で console.error`);
      assert.ok(view.container.querySelector('[data-slot="user-group-criterion-fields"]'), criterion.key);
      await view.unmount();
    }
  }
});

test("欄を書き換えると onChange に整えた引数(数は数、空の欄は落とす)", async () => {
  const seen: Record<string, unknown>[] = [];
  const period = criteria.find((c) => c.key === "signupPeriod")!;
  const view = await render(period.fields, {}, (args) => seen.push(args));
  const input = view.container.querySelector('input[type="number"]') as HTMLInputElement;
  assert.ok(input, "直近の日数の欄");
  const setValue = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setValue.call(input, "7");
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
  assert.deepEqual(seen.at(-1), { withinDays: 7 });
  await view.unmount();
});
