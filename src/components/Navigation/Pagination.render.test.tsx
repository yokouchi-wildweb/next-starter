// Pagination の検査。
// - makeHref(リンクで送る)の出力は、送り方を足す前のコードで記録した __fixtures__/paginationHref.json と同じ
// - onPageChange(ボタンで送る): 同じ並び・ボタン、押すとそのページ番号 / page jump も同じ
// - compact: 前 / p / N / 次 だけ、端は押せない
// - 型: makeHref と onPageChange はどちらか一方
// 実行: pnpm test src/components/Navigation
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";

import Pagination from "@/components/Navigation/Pagination";

import { paginationHrefCases } from "./paginationCases";

const fixtures = JSON.parse(readFileSync("src/components/Navigation/__fixtures__/paginationHref.json", "utf8")) as Record<string, string>;

test("makeHref の出力は前と同じ(端・中・1 ページ・0 件・範囲外・page jump)", () => {
  assert.deepEqual(Object.keys(paginationHrefCases).sort(), Object.keys(fixtures).sort());
  for (const [name, el] of Object.entries(paginationHrefCases)) assert.equal(renderToStaticMarkup(el), fixtures[name], name);
});

test("onPageChange: リンクを出さず、同じ並びのボタン", () => {
  const out = renderToStaticMarkup(createElement(Pagination, { page: 6, perPage: 20, total: 205, onPageChange: () => {} }));
  assert.doesNotMatch(out, /<a /);
  assert.match(out, /101 - 120 （205件中）/);
  const doc = new JSDOM(out).window.document;
  const labels = [...doc.querySelectorAll("button")].map((b) => b.getAttribute("aria-label") ?? b.textContent);
  assert.deepEqual(labels, ["First page", "Previous page", "4", "5", "7", "8", "Next page", "Last page"]);
});

test("compact: 前 / p / N / 次 だけ、端の前 / 次は押せない(makeHref でも onPageChange でも)", () => {
  const first = renderToStaticMarkup(createElement(Pagination, { page: 1, perPage: 20, total: 205, onPageChange: () => {}, compact: true }));
  assert.match(first, /data-slot="pagination-compact"/);
  assert.match(first, />1 \/ 11<\/span>/);
  assert.doesNotMatch(first, /件中|First page|Last page/);
  assert.match(first, /<button[^>]*aria-label="Previous page"[^>]*disabled=""|<button[^>]*disabled=""[^>]*aria-label="Previous page"/);
  const lastHref = renderToStaticMarkup(createElement(Pagination, { page: 11, perPage: 20, total: 205, makeHref: (p: number) => `/l?page=${p}`, compact: true }));
  assert.match(lastHref, /<a [^>]*href="\/l\?page=10"[^>]*aria-label="Previous page"|<a [^>]*aria-label="Previous page"[^>]*href="\/l\?page=10"/);
  assert.match(lastHref, /<button[^>]*disabled=""[^>]*aria-label="Next page"|<button[^>]*aria-label="Next page"[^>]*disabled=""/);
});

// クリックの検査(jsdom の上で描く)
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "Node", "Event", "KeyboardEvent", "navigator"]) {
  const value = key === "window" ? dom.window : (dom.window as unknown as Record<string, unknown>)[key];
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
});
after(() => dom.window.close());

test("onPageChange: 押したページ番号で呼ぶ(番号・前後・最初最後・compact)", async () => {
  const calls: number[] = [];
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(Pagination, { page: 6, perPage: 20, total: 205, onPageChange: (p: number) => calls.push(p) })));
  const click = (sel: string) => (host.querySelector(sel) as HTMLElement).click();
  await act(async () => {
    click('button[aria-label="First page"]');
    click('button[aria-label="Previous page"]');
    click('button[aria-label="Next page"]');
    click('button[aria-label="Last page"]');
    [...host.querySelectorAll("button")].find((b) => b.textContent === "8")!.click();
  });
  assert.deepEqual(calls, [1, 5, 7, 11, 8]);
  calls.length = 0;
  await act(async () => root.render(createElement(Pagination, { page: 3, perPage: 20, total: 205, onPageChange: (p: number) => calls.push(p), compact: true })));
  await act(async () => {
    click('button[aria-label="Previous page"]');
    click('button[aria-label="Next page"]');
  });
  assert.deepEqual(calls, [2, 4]);
  await act(async () => root.unmount());
});

test("型: makeHref と onPageChange はどちらか一方", () => {
  // @ts-expect-error 両方は渡せない
  createElement(Pagination, { page: 1, perPage: 1, total: 1, makeHref: () => "", onPageChange: () => {} });
  // @ts-expect-error どちらも無しは渡せない
  createElement(Pagination, { page: 1, perPage: 1, total: 1 });
});
