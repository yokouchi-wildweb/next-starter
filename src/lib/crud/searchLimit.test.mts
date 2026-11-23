// src/lib/crud/searchLimit.ts のテスト。実行: pnpm test src/lib/crud/searchLimit.test.mts
import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT, resolveSearchLimit } from "./searchLimit.ts";

test("resolveSearchLimit: 無ければ既定、範囲の中はそのまま、上限超え・正でない数は 400(切り詰めない)", () => {
  assert.equal(resolveSearchLimit(undefined), DEFAULT_SEARCH_LIMIT);
  assert.equal(resolveSearchLimit(20), 20);
  assert.equal(resolveSearchLimit(MAX_SEARCH_LIMIT), MAX_SEARCH_LIMIT);
  assert.throws(() => resolveSearchLimit(MAX_SEARCH_LIMIT + 1), (error: unknown) => (error as { status?: number }).status === 400);
  assert.throws(() => resolveSearchLimit(0), /正の整数/);
  assert.throws(() => resolveSearchLimit(1.5), /正の整数/);
});

test("resolveSearchLimit: 呼び手の既定と上限", () => {
  assert.equal(resolveSearchLimit(undefined, { fallback: 20, max: 50 }), 20);
  assert.equal(resolveSearchLimit(50, { fallback: 20, max: 50 }), 50);
  assert.throws(() => resolveSearchLimit(51, { fallback: 20, max: 50 }), /50 以下/);
});
