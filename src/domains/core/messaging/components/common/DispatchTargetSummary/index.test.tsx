// DispatchTargetSummary の検査(jsdom の上で描く。props だけの部品、D210)。
// - 全員・ロール(表示名 roleLabelOf、無ければ id)・グループ(名前、無ければ「グループ」)・選んだ利用者 = 指定と人数だけ。利用者を並べない
// - 宛先を持たない前の送る口の送信 = 人数だけ(recipientCount)。グループの id は出さない
// - 人数が決まっていない(展開の前の全員・ロール・グループ、count null)= 「人数は送る時に決まります」、0 名と出さない
// 実行: pnpm test src/domains/core/messaging/components/common/DispatchTargetSummary/index.test.tsx
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.MouseEvent = dom.window.MouseEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let parts: typeof import("./index");
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  parts = await import("./index");
});
after(() => dom.window.close());

const mountEl = async (el: ReturnType<typeof createElement>) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(el));
  return { container, text: () => container.textContent ?? "", unmount: () => act(async () => root.unmount()) };
};

type Dispatch = Parameters<typeof import("./index").DispatchTargetSummary>[0]["dispatch"];
const base: Dispatch = { target: null, targetGroup: null, recipientCount: 0 };

test("指定の文: 全員・ロール・グループ・選んだ利用者・前の送信", () => {
  assert.equal(parts.dispatchTargetSpecText({ ...base, target: { type: "all", count: 120 } }), "全員");
  assert.equal(
    parts.dispatchTargetSpecText({ ...base, target: { type: "role", roles: ["admin", "editor"], count: 3 } }, (role) => (role === "admin" ? "管理者" : role)),
    "ロール「管理者・editor」",
  );
  assert.equal(parts.dispatchTargetSpecText({ ...base, target: { type: "role", roles: [], count: 0 } }), "ロール");
  assert.equal(parts.dispatchTargetSpecText({ ...base, target: { type: "group", count: 2 }, targetGroup: { id: "g1", name: "常連" } }), "グループ「常連」");
  assert.equal(parts.dispatchTargetSpecText({ ...base, target: { type: "group", count: 2 }, targetGroup: null }), "グループ");
  assert.equal(parts.dispatchTargetSpecText({ ...base, target: { type: "recipients", count: 2 } }), "選んだ利用者");
  assert.equal(parts.dispatchTargetSpecText(base), null);
  assert.equal(parts.dispatchTargetCount({ ...base, target: { type: "all", count: 120 }, recipientCount: 7 }), 120);
  assert.equal(parts.dispatchTargetCount({ ...base, recipientCount: 7 }), 7);
});

test("全員宛ての送信は指定と人数だけを出し、利用者を並べない", async () => {
  const view = await mountEl(createElement(parts.DispatchTargetSummary, { dispatch: { ...base, target: { type: "all", count: 120 }, recipientCount: 120 } }));
  assert.equal(view.text(), "宛先全員 120 名");
  assert.equal(view.container.querySelectorAll("li, [data-slot=dispatch-reader-row], [data-slot=delivery-row]").length, 0, "利用者の一覧は無い");
  await view.unmount();

  const group = await mountEl(
    createElement(parts.DispatchTargetSummary, { dispatch: { ...base, target: { type: "group", count: 2 }, targetGroup: { id: "grp-secret", name: "常連" } } }),
  );
  assert.equal(group.text(), "宛先グループ「常連」 2 名");
  assert.doesNotMatch(group.text(), /grp-secret/, "グループの id は出さない");
  await group.unmount();

  const old = await mountEl(createElement(parts.DispatchTargetSummary, { dispatch: { ...base, recipientCount: 5 } }));
  assert.equal(old.text(), "宛先5 名");
  await old.unmount();
});

test("人数が決まっていない予約の全員宛ては 0 名と出さず「人数は送る時に決まります」、予約の 1 人宛ては 1 名", async () => {
  assert.equal(parts.dispatchTargetCount({ ...base, target: { type: "all", count: null } }), null);
  const all = await mountEl(createElement(parts.DispatchTargetSummary, { dispatch: { ...base, target: { type: "all", count: null }, recipientCount: null } }));
  assert.equal(all.text(), `宛先全員 ${parts.DISPATCH_COUNT_PENDING_TEXT}`);
  assert.doesNotMatch(all.text(), /0 名/);
  await all.unmount();
  const one = await mountEl(createElement(parts.DispatchTargetSummary, { dispatch: { ...base, target: { type: "recipients", count: 1 }, recipientCount: 1 } }));
  assert.equal(one.text(), "宛先選んだ利用者 1 名");
  await one.unmount();
});
