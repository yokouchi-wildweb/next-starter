// src/utils/date.test.ts — pnpm test src/utils/date.test.ts
// formatDateJa が実行環境の時間帯（サーバー = UTC、ブラウザ = 端末の時間帯）によらず同じ文字列を返すことの検査。
// 時間帯の違う 2 つの環境(TZ=UTC と TZ=Pacific/Auckland)で同じ検査を回す: このファイルを直に回すと、自分を TZ を変えた子プロセスで
// 2 回起動し(DATE_TEST_TZ に時間帯)、子の中だけで下の検査が走る。期待値はどちらも同じ（日本時間）。
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

import { dayRangeInTimeZone, formatDateJa, startOfDayInTimeZone } from "./date";

const TIME_ZONES = ["UTC", "Pacific/Auckland"];
const CHILD = process.env.DATE_TEST_TZ;

if (!CHILD) {
  for (const tz of TIME_ZONES) {
    test(`TZ=${tz} の子プロセスで全部通る`, () => {
      // NODE_TEST_CONTEXT は外す(親の node --test の印。残ると子は結果を親向けに流し、落ちても exit 0 になる)
      const { NODE_TEST_CONTEXT: _context, ...env } = process.env;
      const r = spawnSync("npx", ["tsx", "--test", fileURLToPath(import.meta.url)], {
        env: { ...env, TZ: tz, DATE_TEST_TZ: tz },
        encoding: "utf8",
      });
      assert.equal(r.status, 0, `TZ=${tz} で落ちた:\n${r.stdout}\n${r.stderr}`);
    });
  }
}

const check = CHILD ? test : test.skip;

// 2026-11-02T20:30:00Z = 日本時間 2026-11-03 05:30（UTC ではまだ 11/02、Auckland では 11/03 09:30）
const INSTANT = "2026-11-02T20:30:00Z";

check("時刻のある値は既定で日本時間の日付になる", () => {
  assert.equal(formatDateJa(INSTANT), "2026/11/03");
  assert.equal(formatDateJa(new Date(INSTANT)), "2026/11/03");
  assert.equal(formatDateJa(Date.parse(INSTANT)), "2026/11/03");
  assert.equal(formatDateJa(INSTANT, { format: "YYYY/MM/DD HH:mm" }), "2026/11/03 05:30");
});

check("timeZone を渡すとその時間帯で書く", () => {
  assert.equal(formatDateJa(INSTANT, { timeZone: "UTC", format: "YYYY/MM/DD HH:mm" }), "2026/11/02 20:30");
});

check("日付だけの文字列は時間帯で日をずらさない", () => {
  assert.equal(formatDateJa("2026-11-03"), "2026/11/03");
  assert.equal(formatDateJa("2026-01-01"), "2026/01/01");
});

check("ロケールと曜日", () => {
  assert.equal(formatDateJa(INSTANT, { format: "M月D日(ddd)" }), "11月3日(火)");
});

check("値が無い・解析できないときはフォールバック", () => {
  assert.equal(formatDateJa(null, { fallback: "-" }), "-");
  assert.equal(formatDateJa("not a date", { fallback: "-" }), "-");
  assert.equal(formatDateJa({}, { fallback: null }), null);
});

// 日の境目（管理画面の「本日の登録数」など）: 日本時間の 0 時で切る。実行環境の時間帯（UTC / Auckland）によらない
check("日本時間の 0 時をまたぐ前後は別の日になる", () => {
  // 2026-11-02T14:59:59Z = 日本時間 11/02 23:59:59、2026-11-02T15:00:00Z = 日本時間 11/03 00:00
  const beforeMidnight = dayRangeInTimeZone(new Date("2026-11-02T14:59:59Z"));
  assert.equal(beforeMidnight.start.toISOString(), "2026-11-01T15:00:00.000Z");
  assert.equal(beforeMidnight.end.toISOString(), "2026-11-02T15:00:00.000Z");
  const atMidnight = dayRangeInTimeZone(new Date("2026-11-02T15:00:00Z"));
  assert.equal(atMidnight.start.toISOString(), "2026-11-02T15:00:00.000Z");
  assert.equal(atMidnight.end.toISOString(), "2026-11-03T15:00:00.000Z");
  // UTC ではまだ 11/02 の 20:30 も、日本時間では 11/03 の日に入る
  assert.equal(startOfDayInTimeZone(new Date(INSTANT)).toISOString(), "2026-11-02T15:00:00.000Z");
});

check("日の境目も timeZone を渡すとその時間帯で切る（夏時間の日は 23 時間）", () => {
  assert.equal(startOfDayInTimeZone(new Date(INSTANT), { timeZone: "UTC" }).toISOString(), "2026-11-02T00:00:00.000Z");
  // America/New_York は 2026-03-08 に夏時間へ（その日は 23 時間）
  const dst = dayRangeInTimeZone(new Date("2026-03-08T12:00:00Z"), { timeZone: "America/New_York" });
  assert.equal(dst.start.toISOString(), "2026-03-08T05:00:00.000Z");
  assert.equal(dst.end.toISOString(), "2026-03-09T04:00:00.000Z");
});
