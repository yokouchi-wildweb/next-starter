// 画像の拡大表示 ImageViewer の説明文(caption)の検査(jsdom の上で openImage を呼んで開く)。
// - caption を渡さない時: 本体の class・style・中身が変更の前に記録した出力(__fixtures__/imageViewer.before.json)と同じ
// - caption を渡すと画像の下(印 image-viewer-caption)、本体は縦並び、画像の既定の最大の高さは calc(90dvh - 4rem)(maxHeight が勝つ)
// - ZoomableImage の viewerOptions からも渡せる
// 実行: pnpm test src/components/Overlays/ImageViewer
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
g.requestAnimationFrame = dom.window.requestAnimationFrame;
g.cancelAnimationFrame = dom.window.cancelAnimationFrame;
g.IS_REACT_ACT_ENVIRONMENT = true;

type Snap = {
  overlay: string | null | undefined;
  overlayParentIsBody: boolean;
  content: string | null | undefined;
  contentStyle: string | null | undefined;
  contentInner: string | undefined;
};
const BEFORE = JSON.parse(
  readFileSync(new URL("../__fixtures__/imageViewer.before.json", import.meta.url), "utf8"),
) as Record<string, { content: string; style: string; inner: string }>;
let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let IV: typeof import("./index");
before(async () => {
  act = (await import("react")).act;
  createRoot = (await import("react-dom/client")).createRoot;
  IV = await import("./index");
});
after(() => dom.window.close());

type Open = (
  src: string,
  alt?: string,
  options?: Parameters<ReturnType<typeof IV.useImageViewer>["openImage"]>[2],
) => void;

/** Provider を描き、openImage で開いて本体を読む(読んだら片付ける) */
function view(src: string, alt: string | undefined, options: Parameters<Open>[2], read?: (content: Element) => void) {
  let open: Open = () => {};
  const capture = (fn: Open) => {
    open = fn;
  };
  const Probe = () => {
    capture(IV.useImageViewer().openImage);
    return null;
  };
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(IV.ImageViewerProvider, null, createElement(Probe))));
  act(() => open(src, alt, options));
  const content = document.querySelector("[data-slot=dialog-content]")!;
  const out = {
    content: content.getAttribute("class"),
    style: content.getAttribute("style"),
    inner: content.innerHTML.replace(/radix-[^"]+/g, "ID"),
  };
  read?.(content);
  act(() => root.unmount());
  host.remove();
  return out;
}

test("caption なし: 既定・width 指定・skeleton の出力が前と同じ", () => {
  assert.deepEqual(view("/a.png", "A", undefined), BEFORE.plain);
  assert.deepEqual(view("/a.png", undefined, { width: "400px", maxHeight: "70vh" }), BEFORE.width);
  assert.deepEqual(view("/a.png", "A", { showSkeleton: true, aspectRatio: 1 }), BEFORE.skeleton);
});

test("caption: 画像の下・縦並び・画像の既定の最大の高さが詰まる(maxHeight が勝つ)、閉じるボタンは画像の右上のまま", () => {
  const caption = createElement("x-cap", null, "説明");
  const s = view("/a.png", "A", { caption }, (content) => {
    const kids = [...content.children].map((c) => c.getAttribute("data-slot") ?? c.tagName.toLowerCase());
    assert.deepEqual(kids, ["dialog-title", "image-viewer-content", "image-viewer-caption"]);
    assert.ok(content.querySelector("[data-slot=image-viewer-caption] x-cap"));
    const img = content.querySelector("[data-slot=image-viewer-image]")!;
    assert.match(img.getAttribute("style") ?? "", /max-height: calc\(90dvh - 4rem\)/);
    assert.ok(content.querySelector("[data-slot=image-viewer-content] [data-slot=dialog-close]"));
  });
  assert.match(s.style ?? "", /flex-direction: column/);
  view("/a.png", "A", { caption, maxHeight: "50vh" }, (content) => {
    assert.match(
      content.querySelector("[data-slot=image-viewer-image]")!.getAttribute("style") ?? "",
      /max-height: 50vh/,
    );
  });
});

test("ZoomableImage の viewerOptions から caption を渡せる", () => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      createElement(
        IV.ImageViewerProvider,
        null,
        createElement(IV.ZoomableImage, { src: "/a.png", alt: "A", viewerOptions: { caption: "説明文" } }),
      ),
    ),
  );
  act(() => (document.querySelector("[data-component=zoomable-image]") as HTMLElement).click());
  assert.equal(document.querySelector("[data-slot=image-viewer-caption]")?.textContent, "説明文");
  act(() => root.unmount());
  host.remove();
});
