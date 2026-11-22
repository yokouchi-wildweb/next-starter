// src/domains/core/userGroup/services/server/recompute/recompute.test.ts
// 定期計算の期限の規則と、配列の供給の単体テスト(DB なし)。実行: pnpm test src/domains/core/userGroup
import { test } from "node:test";
import assert from "node:assert/strict";

import { arraySupplier } from "../writes/versionWriter";
import { isRecomputeDue } from "./recompute";

const NOW = new Date("2026-11-14T12:00:00.000Z");
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

test("期限: 版が無い・書きかけはすぐ、間隔は グループの値 > 既定、ちょうどで来る", () => {
  assert.equal(isRecomputeDue({ recompute_interval_minutes: null }, null, NOW, 1440), true);
  assert.equal(isRecomputeDue({ recompute_interval_minutes: null }, { status: "computing", startedAt: ago(1) }, NOW, 1440), true);
  assert.equal(isRecomputeDue({ recompute_interval_minutes: null }, { status: "ready", startedAt: ago(1439) }, NOW, 1440), false);
  assert.equal(isRecomputeDue({ recompute_interval_minutes: null }, { status: "ready", startedAt: ago(1440) }, NOW, 1440), true);
  assert.equal(isRecomputeDue({ recompute_interval_minutes: 30 }, { status: "failed", startedAt: ago(31) }, NOW, 1440), true);
  assert.equal(isRecomputeDue({ recompute_interval_minutes: 30 }, { status: "ready", startedAt: ago(29) }, NOW, 1440), false);
});

test("配列の供給: 重複と形の誤りを落とし、昇順に after の後から limit 件", async () => {
  const a = "00000000-0000-4000-8000-000000000001";
  const b = "00000000-0000-4000-8000-000000000002";
  const c = "00000000-0000-4000-8000-000000000003";
  const supply = arraySupplier([c, a, "x", b, a]);
  assert.deepEqual(await supply(null, 2), [a, b]);
  assert.deepEqual(await supply(b, 2), [c]);
  assert.deepEqual(await supply(c, 2), []);
});

test("期限: 条件の定義を最後の版の開始より後に直したらすぐ(前なら間隔どおり)", () => {
  const latest = { status: "ready" as const, startedAt: ago(10) };
  assert.equal(isRecomputeDue({ recompute_interval_minutes: null }, latest, NOW, 1440, ago(5)), true);
  assert.equal(isRecomputeDue({ recompute_interval_minutes: null }, latest, NOW, 1440, ago(15)), false);
  assert.equal(isRecomputeDue({ recompute_interval_minutes: null }, latest, NOW, 1440, null), false);
});
