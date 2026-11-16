// InlineLoader(流れの中の読み込み)の検査。
// - 段ごとの並び・余白・Spinner の大きさ、文の有無(無いときは読み上げ用の隠れた文)、role=status
// - 覆わない(absolute / fixed / backdrop / 背景色を付けない)
// - 共通の部品 AsyncOptionListStates の既定の見た目が置き換えの前と同じ(L1.2: 外側と Spinner の class の集合、文)
// 実行: pnpm test src/components/Overlays/Loading(tsx + node:test、サーバー描画の文字列で比べる)
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { Loader2 } from "lucide-react";

import { AsyncOptionInitialState, AsyncOptionListFooter } from "@/components/Form/Input/Manual/AsyncOptionSource/AsyncOptionListStates";
import { Flex } from "@/components/Layout/Flex";
import { InlineLoader } from "@/components/Overlays/Loading/InlineLoader";

const parse = (el: ReactElement) => {
  const doc = new JSDOM(renderToStaticMarkup(el)).window.document;
  const root = doc.body.firstElementChild as Element;
  const svg = root.querySelector("svg") as Element;
  return { root, svg, classes: tokens(root), svgClasses: tokens(svg), text: root.textContent };
};
const tokens = (el: Element) => new Set((el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean));

test("段ごとの並び・余白・Spinner の大きさ", () => {
  const sm = parse(createElement(InlineLoader, { size: "sm" }));
  assert.ok(sm.classes.has("flex-row") && sm.classes.has("py-2") && sm.classes.has("text-xs"));
  assert.ok(sm.svgClasses.has("size-4") && sm.svgClasses.has("animate-spin"));
  const md = parse(createElement(InlineLoader));
  assert.ok(md.classes.has("flex-col") && md.classes.has("py-8") && md.classes.has("text-sm"));
  assert.ok(md.svgClasses.has("size-6"));
  const lg = parse(createElement(InlineLoader, { size: "lg" }));
  assert.ok(lg.classes.has("flex-col") && lg.classes.has("py-12"));
  assert.ok(lg.svgClasses.has("size-8"));
  for (const r of [sm, md, lg]) {
    assert.ok(r.classes.has("items-center") && r.classes.has("justify-center"));
    assert.equal(r.root.getAttribute("role"), "status");
    assert.equal(r.root.getAttribute("aria-live"), "polite");
  }
});

test("覆わない(absolute / fixed / backdrop / 背景を付けない)", () => {
  for (const size of ["sm", "md", "lg"] as const) {
    const { classes } = parse(createElement(InlineLoader, { size, message: "x" }));
    for (const c of classes) assert.doesNotMatch(c, /^(absolute|fixed|inset-|backdrop-|bg-|z-)/);
  }
});

test("文: 渡せば Spinner の後ろに出る / 無ければ読み上げ用の隠れた文", () => {
  const withMsg = parse(createElement(InlineLoader, { message: "確認しています..." }));
  assert.equal(withMsg.text, "確認しています...");
  assert.equal(withMsg.root.querySelector(".sr-only"), null);
  const without = parse(createElement(InlineLoader));
  assert.equal(without.root.querySelector(".sr-only")?.textContent, "読み込み中");
});

test("direction・className・spinnerClassName で段の値を上書きできる", () => {
  const r = parse(createElement(InlineLoader, { size: "md", direction: "row", className: "py-4 text-primary", spinnerClassName: "size-5" }));
  assert.ok(r.classes.has("flex-row") && !r.classes.has("flex-col"));
  assert.ok(r.classes.has("py-4") && !r.classes.has("py-8"));
  assert.ok(r.classes.has("text-primary") && !r.classes.has("text-muted-foreground"));
  assert.ok(r.svgClasses.has("size-5") && !r.svgClasses.has("size-6"));
});

// 置き換えの前の AsyncOptionListStates の読み込みの形(Flex + 生の Loader2 + 文)
const before = (className: string, spinner: string, text: string) =>
  createElement(Flex, { align: "center", justify: "center", gap: "xs", className }, createElement(Loader2, { className: `${spinner} animate-spin` }), text);

test("AsyncOptionListStates の既定の見た目は置き換えの前と同じ(L1.2)", () => {
  const loading = { items: [], page: 1, total: 0, status: "loading" as const, errorMessage: null };
  const initial = parse(createElement(AsyncOptionInitialState, { state: loading, onRetry: () => {} }));
  const initialBefore = parse(before("py-6 text-sm text-muted-foreground", "size-4", "読み込み中..."));
  assert.deepEqual(initial.classes, initialBefore.classes);
  assert.deepEqual(initial.svgClasses, initialBefore.svgClasses);
  assert.equal(initial.text, initialBefore.text);

  const more = { ...loading, items: [{ value: "a", label: "A" }] };
  const footer = parse(createElement(AsyncOptionListFooter, { state: more, hasMore: true, onRetry: () => {} }));
  const footerBefore = parse(before("py-2 text-xs text-muted-foreground", "size-3", "読み込み中"));
  assert.deepEqual(footer.classes, footerBefore.classes);
  assert.deepEqual(footer.svgClasses, footerBefore.svgClasses);
  assert.equal(footer.text, footerBefore.text);
});
