// src/domains/core/bankTransferReview/presenters.test.ts
// 表示整形の検査: 振込の審査の日時は実行環境の時間帯(サーバー = UTC)によらず日本時間の「YYYY/MM/DD HH:mm」
// 実行: pnpm test src/domains/core/bankTransferReview/presenters.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { formatBankTransferDate } from "./bankTransferReviewPresenters";

test("formatBankTransferDate: UTC の時刻を日本時間で書く(文字列・Date とも、日付の境目もずらす)", () => {
  assert.equal(formatBankTransferDate("2026-11-24T21:52:57Z"), "2026/11/25 06:52");
  assert.equal(formatBankTransferDate(new Date("2026-11-24T03:05:00Z")), "2026/11/24 12:05");
});

test("formatBankTransferDate: 値が無い・読めない = -", () => {
  assert.equal(formatBankTransferDate(null), "-");
  assert.equal(formatBankTransferDate(undefined), "-");
  assert.equal(formatBankTransferDate(""), "-");
  assert.equal(formatBankTransferDate("not a date"), "-");
});
