// src/utils/date.test.ts — pnpm test:utils-date
// formatDateJa が実行環境の時間帯（サーバー = UTC、ブラウザ = 端末の時間帯）によらず同じ文字列を返すことの検査。
// test:utils-date は TZ=UTC と TZ=Pacific/Auckland の 2 回走らせ、期待値はどちらも同じ（日本時間）。
import { test } from "node:test";
import assert from "node:assert/strict";

import { formatDateJa } from "./date";

// 2026-11-02T20:30:00Z = 日本時間 2026-11-03 05:30（UTC ではまだ 11/02、Auckland では 11/03 09:30）
const INSTANT = "2026-11-02T20:30:00Z";

test("時刻のある値は既定で日本時間の日付になる", () => {
  assert.equal(formatDateJa(INSTANT), "2026/11/03");
  assert.equal(formatDateJa(new Date(INSTANT)), "2026/11/03");
  assert.equal(formatDateJa(Date.parse(INSTANT)), "2026/11/03");
  assert.equal(formatDateJa(INSTANT, { format: "YYYY/MM/DD HH:mm" }), "2026/11/03 05:30");
});

test("timeZone を渡すとその時間帯で書く", () => {
  assert.equal(formatDateJa(INSTANT, { timeZone: "UTC", format: "YYYY/MM/DD HH:mm" }), "2026/11/02 20:30");
});

test("日付だけの文字列は時間帯で日をずらさない", () => {
  assert.equal(formatDateJa("2026-11-03"), "2026/11/03");
  assert.equal(formatDateJa("2026-01-01"), "2026/01/01");
});

test("ロケールと曜日", () => {
  assert.equal(formatDateJa(INSTANT, { format: "M月D日(ddd)" }), "11月3日(火)");
});

test("値が無い・解析できないときはフォールバック", () => {
  assert.equal(formatDateJa(null, { fallback: "-" }), "-");
  assert.equal(formatDateJa("not a date", { fallback: "-" }), "-");
  assert.equal(formatDateJa({}, { fallback: null }), null);
});
