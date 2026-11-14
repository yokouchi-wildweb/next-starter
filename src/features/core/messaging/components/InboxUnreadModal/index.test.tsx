// InboxUnreadModal の検査(jsdom の上で描く。流れの hook useInboxUnreadModal と Modal は偽物)。
// - current が無ければ何も描かない / 中身・n/N を描く / 次へ・スキップ・確認完了が hook の next / skip / close を呼ぶ
// 実行: pnpm test src/features/core/messaging/components/InboxUnreadModal/index.test.tsx
// (package.json に type: module が無いので tsx は CJS として読む = top-level await 不可 → before() で import)
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.MouseEvent = dom.window.MouseEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;

const calls: string[] = [];
let state: Record<string, unknown> = {};
mock.module("@/features/core/messaging/hooks/useInboxUnreadModal", {
  namedExports: {
    useInboxUnreadModal: () => ({
      ...state,
      next: () => calls.push("next"),
      skip: async () => void calls.push("skip"),
      close: () => calls.push("close"),
    }),
  },
});
mock.module("@/components/Overlays/Modal", {
  defaultExport: ({ open, title, children }: { open: boolean; title?: unknown; children?: unknown }) =>
    open ? createElement("section", { "data-testid": "modal" }, title as never, children as never) : null,
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let InboxUnreadModal: typeof import("./index").InboxUnreadModal;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ InboxUnreadModal } = await import("./index"));
});
after(() => dom.window.close());

const current = { id: "a", title: "お知らせ A", body: "本文 A", link: null, image: null, metadata: null, publishedAt: "2026-11-01T00:00:00.000Z", read: false };
beforeEach(() => {
  calls.length = 0;
  state = { open: true, current, index: 0, total: 2, isLast: false, isSkipping: false };
});

const mount = async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(InboxUnreadModal)));
  return { container, unmount: () => act(async () => root.unmount()) };
};
const button = (c: HTMLElement, label: string) => [...c.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes(label));

test("current が無ければ何も描かない", async () => {
  state = { open: false, current: null, index: 0, total: 0, isLast: true, isSkipping: false };
  const view = await mount();
  assert.equal(view.container.innerHTML, "");
  await view.unmount();
});

test("中身と n/N。次へ・スキップは hook を呼ぶ", async () => {
  const view = await mount();
  const text = view.container.textContent ?? "";
  assert.match(text, /お知らせ A/);
  assert.match(text, /本文 A/);
  assert.match(text, /1\/2/);
  await act(async () => button(view.container, "次へ")!.click());
  await act(async () => button(view.container, "スキップ")!.click());
  assert.deepEqual(calls, ["next", "skip"]);
  await view.unmount();
});

test("最後の行は確認完了 → close", async () => {
  state = { ...state, index: 1, isLast: true };
  const view = await mount();
  assert.equal(button(view.container, "次へ"), undefined);
  await act(async () => button(view.container, "確認完了")!.click());
  assert.deepEqual(calls, ["close"]);
  await view.unmount();
});
