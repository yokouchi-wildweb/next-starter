// InfiniteScrollList の検査(サーバー描画の文字列で比べる)。
// - 新しい指定を渡さない出力は、指定を足す前のコードで記録した __fixtures__/defaultOutput.json と同じ
// - fetchingMoreNode / completedNode / emptyNode={null} / loadMode="button" / direction="prepend"
// 実行: pnpm test src/components/Widgets/InfiniteScrollList
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { InfiniteScrollList } from "@/components/Widgets/InfiniteScrollList";

import { defaultCases } from "./renderCases";

const fixtures = JSON.parse(
  readFileSync("src/components/Widgets/InfiniteScrollList/__fixtures__/defaultOutput.json", "utf8"),
) as Record<string, string>;

const noop = () => {};
const list = (items: string[]) => createElement("ul", null, ...items.map((i) => createElement("li", { key: i }, i)));
const base = { items: ["a", "b"], isInitialLoading: false, isFetchingMore: false, hasMore: false, sentinelRef: noop, children: list };
const html = (props: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(InfiniteScrollList<string>, { ...base, ...props } as never));

test("新しい指定を渡さない出力は前と同じ(全ての状態)", () => {
  assert.deepEqual(Object.keys(defaultCases).sort(), Object.keys(fixtures).sort());
  for (const [name, el] of Object.entries(defaultCases)) {
    assert.equal(renderToStaticMarkup(el), fixtures[name], name);
  }
});

test("fetchingMoreNode は sentinel の中身だけを差し替える(要素と h-12 は残る)", () => {
  const out = html({ hasMore: true, isFetchingMore: true, fetchingMoreNode: createElement("i", null, "ロード") });
  assert.match(out, /<\/ul><div data-component="Flex" class="[^"]*h-12[^"]*"><i>ロード<\/i><\/div>$/);
  // 待機中は中身を出さない
  const idle = html({ hasMore: true, fetchingMoreNode: createElement("i", null, "ロード") });
  assert.doesNotMatch(idle, /ロード/);
  assert.equal(idle, fixtures.idleMore);
});

test("completedNode は終端を差し替える / hideCompletedNotice が優先", () => {
  assert.match(html({ completedNode: createElement("b", null, "全部") }), /<\/ul><b>全部<\/b>$/);
  assert.match(html({ completedNode: createElement("b", null, "全部"), hideCompletedNotice: true }), /<\/ul>$/);
});

test("emptyNode={null} は空の時に何も出さない / undefined は既定", () => {
  assert.equal(html({ items: [], emptyNode: null }), "");
  assert.equal(html({ items: [] }), fixtures.empty);
});

test("loadMode=button: sentinel を付けずボタン、読み込み中は Button の loading", () => {
  const idle = html({ hasMore: true, loadMode: "button", onLoadMore: noop, sentinelRef: undefined });
  assert.match(idle, /<button[^>]*>もっと見る<\/button>/);
  assert.doesNotMatch(idle, /h-12/);
  const busy = html({ hasMore: true, isFetchingMore: true, loadMode: "button", onLoadMore: noop, loadMoreLabel: "過去のメッセージ", sentinelRef: undefined });
  assert.match(busy, /<button[^>]*disabled=""[^>]*aria-busy="true"[^>]*><svg[^>]*animate-spin[^>]*>.*<\/svg>過去のメッセージ<\/button>/);
  // 続きが無ければボタンは出ず終端
  assert.doesNotMatch(html({ loadMode: "button", onLoadMore: noop, sentinelRef: undefined }), /<button/);
});

test("direction=prepend: 足元は一覧の上", () => {
  const more = html({ hasMore: true, loadMode: "button", onLoadMore: noop, sentinelRef: undefined, direction: "prepend" });
  assert.match(more, /^<div[^>]*><button[^>]*>もっと見る<\/button><\/div><ul>/);
  const auto = html({ hasMore: true, direction: "prepend" });
  assert.match(auto, /^<div data-component="Flex" class="[^"]*h-12[^"]*"><\/div><ul>/);
  const done = html({ direction: "prepend" });
  assert.match(done, /^<div[^>]*>.*すべてのアイテムを表示しました.*<\/div><ul>/);
  const failed = html({ error: new Error("x"), direction: "prepend" });
  assert.match(failed, /^<div[^>]*>.*続きの読み込みに失敗しました.*<\/div><ul>/);
});
