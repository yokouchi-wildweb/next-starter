// DispatchReaders の検査(jsdom の上で描く。props だけの部品、D210)。
// - 頭の一文(時刻のある既読だけ・数は集計の値)、行 = 名前(無ければ「名前未設定のユーザー」)と既読の時刻、利用者の id は出さない
// - 0 件の文、button の読み方で「もっと見る」が readers.loadMore を呼ぶ
// 実行: pnpm test src/domains/core/messaging/components/common/DispatchReaders/index.test.tsx
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

type Props = Parameters<typeof import("./index").DispatchReaders>[0];
const page = (over: Partial<Props["readers"]> = {}): Props["readers"] => ({
  items: [],
  isInitialLoading: false,
  isFetchingMore: false,
  hasMore: false,
  error: null,
  sentinelRef: () => {},
  retry: () => {},
  loadMore: () => {},
  ...over,
});

test("頭の一文と既読した利用者の行(名前・既読の時刻)、id は出さない", async () => {
  const view = await mountEl(
    createElement(parts.DispatchReaders, {
      readers: page({
        items: [
          { userId: "u1", name: "花子", readAt: "2026-11-01T00:00:00.000Z" },
          { userId: "u2", name: null, readAt: "2026-10-31T00:00:00.000Z" },
        ],
      }),
    }),
  );
  assert.equal(view.container.querySelector("[data-slot=dispatch-readers-note]")?.textContent, parts.DISPATCH_READERS_NOTE);
  assert.equal(parts.DISPATCH_READERS_NOTE, "時刻のある既読だけを並べます。数は集計の値です");
  const rows = [...view.container.querySelectorAll("[data-slot=dispatch-reader-row]")].map((row) => row.textContent ?? "");
  assert.equal(rows.length, 2);
  assert.match(rows[0]!, /花子/);
  assert.match(rows[0]!, new RegExp(new Date("2026-11-01T00:00:00.000Z").toLocaleString("ja-JP").replace(/[/:]/g, "\\$&")));
  assert.match(rows[1]!, /\(名前未設定のユーザー\)/);
  assert.doesNotMatch(view.text(), /u1|u2/, "利用者の id は出さない");
  await view.unmount();
});

test("0 件の文、button の読み方は「もっと見る」で loadMore", async () => {
  const empty = await mountEl(createElement(parts.DispatchReaders, { readers: page() }));
  assert.match(empty.text(), /既読した利用者はまだいません/);
  await empty.unmount();

  let loaded = 0;
  const more = await mountEl(
    createElement(parts.DispatchReaders, {
      loadMode: "button",
      readers: page({ items: [{ userId: "u1", name: "花子", readAt: "2026-11-01T00:00:00.000Z" }], hasMore: true, loadMore: () => void loaded++ }),
    }),
  );
  const button = [...more.container.querySelectorAll("button")].find((el) => /もっと見る/.test(el.textContent ?? ""));
  assert.ok(button, "もっと見るのボタン");
  await act(async () => button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })));
  assert.equal(loaded, 1);
  await more.unmount();
});
