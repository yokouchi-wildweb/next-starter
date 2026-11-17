// 管理の SP のサイドバー(Overlays/Sheet の side right)の検査(jsdom の上で開いて読む)。
// - 閉じている間は描かない / 開くと右の板(幅 = サイドバーの幅、層 navigation、背景 backdrop、md:hidden)、印 admin-sidebar は板と背景の 2 つ
// - 中身は殻の placement "sp" / width を useAdminSidebarFrame() で読み、close() と背景を押すと onClose
// 実行: pnpm test "src/app/admin/(protected)/_layout/Sidebar/SpSidebar.render.test.tsx"
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
g.Element = dom.window.Element;
g.NodeFilter = dom.window.NodeFilter;
g.MutationObserver = dom.window.MutationObserver;
g.Event = dom.window.Event;
g.CustomEvent = dom.window.CustomEvent;
g.FocusEvent = dom.window.FocusEvent;
g.KeyboardEvent = dom.window.KeyboardEvent;
g.MouseEvent = dom.window.MouseEvent;
g.getComputedStyle = dom.window.getComputedStyle;
g.IS_REACT_ACT_ENVIRONMENT = true;

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let SpSidebar: typeof import("./SpSidebar").SpSidebar;
let useAdminSidebarFrame: typeof import("@/app/admin/_layout/Sidebar/AdminSidebarFrame").useAdminSidebarFrame;
before(async () => {
  act = (await import("react")).act;
  createRoot = (await import("react-dom/client")).createRoot;
  SpSidebar = (await import("./SpSidebar")).SpSidebar;
  useAdminSidebarFrame = (await import("@/app/admin/_layout/Sidebar/AdminSidebarFrame")).useAdminSidebarFrame;
});
after(() => dom.window.close());

test("閉じている間は描かず、開くと右の板と背景に admin-sidebar の印、中身は殻の sp / width を読み、close と背景で onClose", async () => {
  let closed = 0;
  let frameClose: () => void = () => {};
  const capture = (close: () => void) => {
    frameClose = close;
  };
  const Probe = () => {
    const frame = useAdminSidebarFrame();
    capture(frame.close);
    return createElement("x-probe", { "data-placement": frame.placement, "data-width": String(frame.width) });
  };
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const el = (isOpen: boolean) =>
    createElement(SpSidebar, { width: 192, isOpen, onClose: () => (closed += 1), content: createElement(Probe) });

  act(() => root.render(el(false)));
  assert.equal(document.querySelector("[data-slot=admin-sidebar]"), null);

  act(() => root.render(el(true)));
  const marks = [...document.querySelectorAll("[data-slot=admin-sidebar]")];
  assert.equal(marks.length, 2);
  const panel = document.querySelector("[role=dialog]")!;
  assert.equal(panel.getAttribute("data-slot"), "admin-sidebar");
  const c = (panel.getAttribute("class") ?? "").split(" ");
  for (const k of ["right-0", "navigation-layer", "md:hidden", "border-l-0"]) assert.ok(c.includes(k), k);
  assert.match(panel.getAttribute("style") ?? "", /width: 192px/);
  const overlay = marks.find((m) => m !== panel)!;
  for (const k of ["backdrop-layer", "md:hidden"])
    assert.ok((overlay.getAttribute("class") ?? "").split(" ").includes(k), k);
  assert.ok(panel.querySelector('x-probe[data-placement="sp"][data-width="192"]'));

  act(() => frameClose());
  assert.equal(closed, 1);
  await new Promise((r) => setTimeout(r, 10));
  act(() => {
    overlay.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true, button: 0 }));
  });
  act(() => {
    overlay.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, button: 0 }));
  });
  assert.equal(closed, 2);

  act(() => root.unmount());
  host.remove();
});
