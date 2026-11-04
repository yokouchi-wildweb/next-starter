// 枠の表の共通の読み手 useFrameAttributes の検査(利用者・管理の枠の根が共有する。各根の検査は表の結線だけを見る)。
// 実行: pnpm test:frame-declaration(tsx + node:test のモジュールモック + react-dom/server の静的描画)
// (package.json に type: module が無いので tsx は CJS として読む = top-level await 不可 → before() で import)
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactNode } from "react";

import type { FrameTable } from "./types";

const segments: { current: string[] | null } = { current: null };
mock.module("next/navigation", { namedExports: { useSelectedLayoutSegments: () => segments.current } });

let render: (node: ReactNode) => string;
let useFrameAttributes: typeof import("./useFrameAttributes").useFrameAttributes;
before(async () => {
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  ({ useFrameAttributes } = await import("./useFrameAttributes"));
});

const TABLE: FrameTable = [
  { pattern: [], scope: "layout", hide: ["bottom-nav-pc"], fill: false },
  { pattern: [], scope: "page", hide: ["bottom-nav-pc"], fill: true },
  { pattern: ["(auth)", "signup"], scope: "layout", hide: ["footer-sp", "bottom-nav-sp", "bottom-nav-pc"], fill: false },
  { pattern: ["x", "[id]"], scope: "page", hide: ["header-sp", "header-pc"], fill: true },
  { pattern: ["x", "new"], scope: "page", hide: ["bottom-nav-pc"], fill: false },
];

/** 今の segments で読み手を描いた要素の開始タグ */
const at = (current: string[] | null, table: FrameTable = TABLE) => {
  segments.current = current;
  const Probe = () => createElement("x-frame", useFrameAttributes(table));
  return render(createElement(Probe));
};

test("当たる行の値を属性にする: layout の行は下全部、page の行はそのページだけ、静的な兄弟は自分の行", () => {
  assert.equal(at([]), '<x-frame data-frame-hide="bottom-nav-pc" data-frame-fill=""></x-frame>', "根のページ(page の行が layout の行に勝つ)");
  assert.equal(at(["(public)", "about"]), '<x-frame data-frame-hide="bottom-nav-pc"></x-frame>', "page の行は子に継がない");
  assert.equal(at(["(auth)", "signup", "verify"]), '<x-frame data-frame-hide="footer-sp bottom-nav-sp bottom-nav-pc"></x-frame>');
  assert.equal(at(["x", "1"]), '<x-frame data-frame-hide="header-sp header-pc" data-frame-fill=""></x-frame>');
  assert.equal(at(["x", "new"]), '<x-frame data-frame-hide="bottom-nav-pc"></x-frame>', "静的な兄弟は動的な段の行に当たらない");
});

test("何も隠さず fill でもなければ属性を付けない、app router の外(null)は segments = [] と同じ", () => {
  assert.equal(at(["a"], []), "<x-frame></x-frame>");
  assert.equal(at(null), at([]));
});
