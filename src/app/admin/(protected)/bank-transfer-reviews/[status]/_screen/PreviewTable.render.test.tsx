// 銀行振込の CSV 取り込みの下見の表(PreviewTable、DataTable で描く)の検査: 列の並び・出す値・エラーの行の色
// 実行: pnpm test "src/app/admin/(protected)/bank-transfer-reviews"
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";

import type { BankTransferReviewImportRowDto } from "@/features/core/bankTransferReview";
import { formatJpyAmount } from "@/features/core/bankTransferReview/presenters";

import { PreviewTable } from "./BankTransferReviewCsvImportDialog";

const row = (over: Partial<BankTransferReviewImportRowDto>): BankTransferReviewImportRowDto => ({
  rowIndex: 2,
  status: "ok",
  message: null,
  rawTransferName: "ヤマダ タロウ",
  rawAmount: "1000",
  parsedIdentifier: "A123",
  parsedAmount: 1000,
  resolvedReviewId: "r1",
  expectedAmount: 1000,
  decision: "confirm",
  ...over,
});

test("列の並び・値・エラーの行", () => {
  const rows = [
    row({}),
    row({ rowIndex: 3, status: "error", message: "金額が違います", parsedIdentifier: null, parsedAmount: null, expectedAmount: null, rawTransferName: "" }),
  ];
  const doc = new JSDOM(renderToStaticMarkup(createElement(PreviewTable, { rows }))).window.document;
  assert.deepEqual([...doc.querySelectorAll("th")].map((th) => th.textContent), ["行", "判定", "振込人名", "識別番号", "CSV金額", "期待金額", "メッセージ"]);
  const cells = [...doc.querySelectorAll("tbody tr")].map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent));
  assert.deepEqual(cells[0], ["2", "承認", "ヤマダ タロウ", "A123", formatJpyAmount(1000), formatJpyAmount(1000), ""]);
  assert.deepEqual(cells[1], ["3", "エラー", "-", "-", "-", "-", "金額が違います"]);
  const trs = doc.querySelectorAll("tbody tr");
  assert.ok(trs[1].getAttribute("class")!.split(/\s+/).includes("bg-destructive/5"));
  assert.ok(!trs[0].getAttribute("class")!.split(/\s+/).includes("bg-destructive/5"));
});
