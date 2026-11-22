// 管理のユーザー管理モーダルのタブの受け口(adminManageTabs)の検査(jsdom。タブの中身の部品・受け口の一覧・門番は偽物)。
// - 項目が無い時: タブの列と中身が変更の前に記録した出力(__fixtures__/adminUserManageModal.before.json)と同じ
// - 項目は上流の 6 つのタブの後ろに order → key の順、Content に user と onClose、feature が閉の項目と上流と重なる key は出さない
// 実行: pnpm test src/domains/core/user/components/admin/AdminUserManageModal
import { after, before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement, type ComponentType } from "react";
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.Element = dom.window.Element;
g.NodeFilter = dom.window.NodeFilter;
g.MutationObserver = dom.window.MutationObserver;
g.Event = dom.window.Event;
g.CustomEvent = dom.window.CustomEvent;
g.FocusEvent = dom.window.FocusEvent;
g.KeyboardEvent = dom.window.KeyboardEvent;
g.MouseEvent = dom.window.MouseEvent;
g.getComputedStyle = dom.window.getComputedStyle;
g.requestAnimationFrame = dom.window.requestAnimationFrame;
g.cancelAnimationFrame = dom.window.cancelAnimationFrame;
g.IS_REACT_ACT_ENVIRONMENT = true;

// タブの中身の部品は偽物(この検査はタブの並びと受け口の項目だけを見る)
const stub = (name: string) => {
  const Stub = (props: { user: { id: string }; onClose?: () => void }) =>
    createElement("x-tab", { "data-name": name, "data-user": props.user.id, "data-close": typeof props.onClose });
  Stub.displayName = `Stub(${name})`;
  return Stub;
};
for (const name of [
  "SummaryTabContent",
  "AuthTabContent",
  "StatusTabContent",
  "RoleTabContent",
  "DeleteTabContent",
  "HistoryTabContent",
]) {
  mock.module(`./${name}`, { namedExports: { [name]: stub(name) } });
}

type Item = import("@/domains/core/user/types").UserAdminManageTabItem;
let items: Record<string, Item> = {};
mock.module("@/domains/core/user/extensions/adminManageTabs", {
  namedExports: {
    get adminManageTabs() {
      return items;
    },
  },
});
const closed = new Set<string>();
mock.module("@/featureGate/client", {
  namedExports: { useGate: () => ({ enabled: (feature: string) => !closed.has(feature) }) },
});

const BEFORE = JSON.parse(
  readFileSync(new URL("./__fixtures__/adminUserManageModal.before.json", import.meta.url), "utf8"),
) as { tabs: { value: string; label: string }[]; html: string };

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let Modal: ComponentType<Record<string, unknown>>;
before(async () => {
  act = (await import("react")).act;
  createRoot = (await import("react-dom/client")).createRoot;
  Modal = (await import("./index")).default as unknown as ComponentType<Record<string, unknown>>;
});
after(() => dom.window.close());

async function open(read: (content: Element) => void | Promise<void>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(createElement(Modal, { open: true, user: { id: "u1", name: "太郎" }, onClose: () => {} })),
  );
  await read(document.querySelector("[data-slot=dialog-content]")!);
  await act(async () => root.unmount());
  host.remove();
}
const tabsOf = (content: Element) =>
  [...content.querySelectorAll("[role=tab]")].map((t) => ({
    value: t.getAttribute("id")?.replace(/^.*-trigger-/, ""),
    label: t.textContent,
  }));

test("項目が無い時: タブの列と中身が前と同じ", async () => {
  items = {};
  await open((content) => {
    assert.deepEqual(tabsOf(content), BEFORE.tabs);
    assert.equal(content.innerHTML.replace(/radix-[^"]+/g, "ID"), BEFORE.html);
  });
});

test("項目は上流の後ろに order → key の順、Content に user と onClose、閉じた機能と上流と重なる key は出さない", async () => {
  const content = (name: string): Item["Content"] => {
    const C = (props: { user: { id: string }; onClose: () => void }) =>
      createElement("x-extra", { "data-name": name, "data-user": props.user.id, "data-close": typeof props.onClose });
    return C as unknown as Item["Content"];
  };
  const warn = console.warn;
  const warned: string[] = [];
  console.warn = (m: string) => warned.push(m);
  items = {
    zeta: { key: "zeta", label: "Z", Content: content("zeta") },
    alpha: { key: "alpha", label: "A", order: 0, Content: content("alpha") },
    first: { key: "first", label: "F", order: -1, Content: content("first") },
    gated: { key: "gated", label: "G", feature: "wallet" as Item["feature"], Content: content("gated") },
    status: { key: "status", label: "上書き", Content: content("status") },
  };
  closed.add("wallet");
  try {
    await open(async (dialog) => {
      const tabs = tabsOf(dialog);
      assert.deepEqual(tabs.slice(0, 6), BEFORE.tabs);
      assert.deepEqual(tabs.slice(6), [
        { value: "first", label: "F" },
        { value: "alpha", label: "A" },
        { value: "zeta", label: "Z" },
      ]);
      const tab = dialog.querySelector('[role=tab][id$="-trigger-alpha"]') as HTMLElement;
      await act(async () => {
        tab.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, button: 0 }));
      });
      const extra = dialog.querySelector('x-extra[data-name="alpha"]');
      assert.ok(extra);
      assert.equal(extra!.getAttribute("data-user"), "u1");
      assert.equal(extra!.getAttribute("data-close"), "function");
    });
    assert.ok(warned.some((m) => m.includes('"status"')));
  } finally {
    console.warn = warn;
    closed.clear();
    items = {};
  }
});
