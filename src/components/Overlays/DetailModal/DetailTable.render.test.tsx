// DetailTable(鍵と値の表)の検査: 入口から使え、出力は公開する前と同じ(DetailModal の中の表と同じ物)
// 実行: pnpm test src/components/Overlays/DetailModal
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import { DetailTable } from "@/components/Overlays/DetailModal";

import { detailTableCases } from "./detailTableCases";

const fixtures = JSON.parse(readFileSync("src/components/Overlays/DetailModal/__fixtures__/detailTable.json", "utf8")) as Record<string, string>;

test("DetailTable の出力は公開する前と同じ(値の配列 / label と value のセル)", () => {
  assert.deepEqual(Object.keys(detailTableCases).sort(), Object.keys(fixtures).sort());
  for (const [name, el] of Object.entries(detailTableCases)) assert.equal(renderToStaticMarkup(el), fixtures[name], name);
});

test("入口の DetailTable は DetailModal が使う物と同じ", async () => {
  const inner = (await import("./DetailTable")).default;
  assert.equal(DetailTable, inner);
});
