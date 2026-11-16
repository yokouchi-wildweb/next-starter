// 表の無限の足元(infiniteFooter)の検査(サーバー描画の文字列で比べる)。
// - 渡さない 3 つの表の出力は、足す前のコードで記録した __fixtures__/infiniteFooterDefault.json と同じ
// - 読み込み中 / 終端(total・completedText)/ 待機中は無し / 差し替え。位置はスクロール領域の中・表の下・sentinel の直前
// 実行: pnpm test src/lib/tableSuite
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DataTable, EditableGridTable, RecordSelectionTable } from "@/lib/tableSuite";

import { tableDefaultCases } from "./infiniteFooterCases";

const fixtures = JSON.parse(readFileSync("src/lib/tableSuite/__fixtures__/infiniteFooterDefault.json", "utf8")) as Record<string, string>;

type Row = { id: string; name: string };
const items: Row[] = [{ id: "1", name: "a" }];
const sentinel = () => {};
const getKey = (r: Row) => r.id;
const dataColumns = [{ header: "名前", render: (r: Row) => r.name }];
const gridColumns = [{ field: "name", header: "名前", editorType: "readonly" as const }];

const tables = {
  DataTable: (infiniteFooter: object) => createElement(DataTable<Row>, { items, columns: dataColumns, getKey, bottomSentinelRef: sentinel, infiniteFooter } as never),
  RecordSelectionTable: (infiniteFooter: object) => createElement(RecordSelectionTable<Row>, { items, columns: dataColumns, getKey, bottomSentinelRef: sentinel, infiniteFooter } as never),
  EditableGridTable: (infiniteFooter: object) => createElement(EditableGridTable<Row>, { items, columns: gridColumns, getKey, bottomSentinelRef: sentinel, infiniteFooter } as never),
};

test("infiniteFooter を渡さない 3 つの表の出力は前と同じ", () => {
  assert.deepEqual(Object.keys(tableDefaultCases).sort(), Object.keys(fixtures).sort());
  for (const [name, el] of Object.entries(tableDefaultCases)) assert.equal(renderToStaticMarkup(el), fixtures[name], name);
});

for (const [name, render] of Object.entries(tables)) {
  test(`${name}: 読み込み中は表の下・sentinel の直前に Spinner +「読み込み中...」`, () => {
    const out = renderToStaticMarkup(render({ isFetchingMore: true, hasMore: true }));
    assert.match(out, /<\/table><\/div>(?:<\/div>)*<div[^>]*data-slot="table-infinite-footer"[^>]*><svg[^>]*animate-spin[^>]*>.*<\/svg><p[^>]*>読み込み中\.\.\.<\/p><\/div><div aria-hidden="true" class="h-px w-full"><\/div>/);
  });
  test(`${name}: 待機中(続きあり・読み込みなし)は何も出さない`, () => {
    assert.doesNotMatch(renderToStaticMarkup(render({ isFetchingMore: false, hasMore: true })), /table-infinite-footer/);
  });
  test(`${name}: 終端は total で「全 N 件を表示しました」、無ければ completedText`, () => {
    assert.match(renderToStaticMarkup(render({ isFetchingMore: false, hasMore: false, total: 1234 })), /全 1,234 件を表示しました/);
    assert.match(renderToStaticMarkup(render({ isFetchingMore: false, hasMore: false })), /すべて表示しました/);
    assert.match(renderToStaticMarkup(render({ isFetchingMore: false, hasMore: false, completedText: "おわり" })), /おわり/);
  });
}

test("差し替え: fetchingMoreNode / completedNode(null = 出さない)", () => {
  assert.match(renderToStaticMarkup(tables.DataTable({ isFetchingMore: true, hasMore: true, fetchingMoreNode: createElement("i", null, "ロード") })), /table-infinite-footer"[^>]*><i>ロード<\/i>/);
  assert.match(renderToStaticMarkup(tables.DataTable({ isFetchingMore: false, hasMore: false, completedNode: createElement("b", null, "完") })), /<b>完<\/b><div aria-hidden/);
  assert.doesNotMatch(renderToStaticMarkup(tables.DataTable({ isFetchingMore: false, hasMore: false, completedNode: null })), /table-infinite-footer|表示しました/);
});
