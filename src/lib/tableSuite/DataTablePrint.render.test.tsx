// DataTable の印刷の表(variant="print")の検査。variant 無しの出力は 06 で記録した出力と同じ
// 実行: pnpm test src/lib/tableSuite
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";

import { DataTable } from "./index";

import { tableDefaultCases } from "./infiniteFooterCases";

const fixtures = JSON.parse(readFileSync("src/lib/tableSuite/__fixtures__/infiniteFooterDefault.json", "utf8")) as Record<string, string>;

type Row = { id: string; name: string };
const items: Row[] = [
  { id: "1", name: "a" },
  { id: "2", name: "b" },
];
const columns = [
  { header: "ID", render: (r: Row) => r.id },
  { header: "名前", render: (r: Row) => r.name },
];
const classes = (el: Element | null) => new Set((el?.getAttribute("class") ?? "").split(/\s+/).filter(Boolean));

test("variant 無しの DataTable は前と同じ", () => {
  assert.equal(renderToStaticMarkup(tableDefaultCases.dataTable), fixtures.dataTable);
  assert.equal(renderToStaticMarkup(tableDefaultCases.dataTableSentinel), fixtures.dataTableSentinel);
});

test("variant=print: スクロールの箱なし・小さな文字と素の罫線・hover と縞なし", () => {
  const html = renderToStaticMarkup(
    createElement(DataTable<Row>, { items, columns, getKey: (r: Row) => r.id, variant: "print", maxHeight: "200px", className: "print-area" }),
  );
  const doc = new JSDOM(html).window.document;
  const box = doc.body.firstElementChild!;
  assert.equal(box.getAttribute("style"), null);
  assert.ok(classes(box).has("print-area"));
  for (const c of classes(box)) assert.doesNotMatch(c, /^overflow-/);
  const table = classes(doc.querySelector("table"));
  assert.ok(table.has("text-xs") && table.has("border-collapse") && !table.has("text-sm"));
  const th = classes(doc.querySelector("th"));
  assert.ok(th.has("border") && th.has("font-semibold"));
  assert.ok(classes(doc.querySelector("td")).has("border"));
  for (const tr of doc.querySelectorAll("tbody tr")) {
    const c = classes(tr);
    assert.ok(!c.has("even:bg-muted/50"));
    assert.ok(!c.has("hover:bg-accent/20"));
  }
});
