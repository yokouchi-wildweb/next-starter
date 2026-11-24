// src/domains/core/rateLimit/services/server/consume.test.mts
// consumeRateLimit / peekRateLimit の入力の確かめと規則の解き方を偽物の表で回す(SQL の数え方は rateLimit.db.test.mts)。
// 実行: pnpm test src/domains/core/rateLimit/services/server/consume.test.mts
import assert from "node:assert/strict";
import { test } from "node:test";

import { createRateLimit } from "./consume";
import type { FixedInput, RateLimitStore, SlidingInput } from "./store";

function fakeStore() {
  const calls: Array<{ op: string; input: FixedInput | SlidingInput }> = [];
  const counts = new Map<string, number>();
  const answer = (input: FixedInput, add: boolean) => {
    const count = counts.get(input.key) ?? 0;
    const allowed = count + input.weight <= input.limit;
    if (add && allowed) counts.set(input.key, count + input.weight);
    return { allowed, count: add && allowed ? count + input.weight : count, resetAt: new Date(input.now.getTime() + input.windowSeconds * 1000) };
  };
  const store: RateLimitStore = {
    async consumeFixed(input) { calls.push({ op: "consumeFixed", input }); return answer(input, true); },
    async peekFixed(input) { calls.push({ op: "peekFixed", input }); return answer(input, false); },
    async consumeSliding(input) { calls.push({ op: "consumeSliding", input }); return answer(input, true); },
    async peekSliding(input) { calls.push({ op: "peekSliding", input }); return answer(input, false); },
  };
  return { store, calls };
}

const NOW = new Date("2026-01-01T00:00:00Z");
const setup = () => {
  const fake = fakeStore();
  return { ...fake, rl: createRateLimit({ store: fake.store, categories: { signup: { windowSeconds: 60, maxRequests: 3 } }, now: () => NOW }) };
};

test("カテゴリの規則 = 固定の窓・maxRequests 回まで(正しく数える)、remaining = limit − count、鍵 = <scope>:<identifier>", async () => {
  const { rl, calls } = setup();
  const results = [];
  for (let i = 0; i < 4; i += 1) results.push(await rl.consumeRateLimit({ key: { scope: "signup", identifier: "1.2.3.4" }, rule: "signup" }));
  assert.deepEqual(results.map((r) => [r.allowed, r.count, r.remaining]), [[true, 1, 2], [true, 2, 1], [true, 3, 0], [false, 3, 0]]);
  assert.equal(calls[0].input.key, "signup:1.2.3.4");
  assert.equal(calls[0].input.windowSeconds, 60);
  assert.equal(calls[0].input.limit, 3);
});

test("窓を直に書く規則: sliding は bucketSeconds つきで滑る窓の表へ、weight を渡す、peek は足さない", async () => {
  const { rl, calls } = setup();
  const rule = { window: "sliding" as const, windowSeconds: 3600, bucketSeconds: 60, limit: 10 };
  const key = { scope: "gachaRaid.play", identifier: "machine-1:user-1" };
  assert.equal((await rl.consumeRateLimit({ key, rule, weight: 7 })).remaining, 3);
  assert.equal((await rl.peekRateLimit({ key, rule, weight: 4 })).allowed, false);
  assert.equal((await rl.peekRateLimit({ key, rule, weight: 3 })).allowed, true);
  assert.equal((await rl.consumeRateLimit({ key, rule, weight: 4 })).allowed, false);
  assert.deepEqual(calls.map((c) => c.op), ["consumeSliding", "peekSliding", "peekSliding", "consumeSliding"]);
  assert.equal((calls[0].input as SlidingInput).bucketSeconds, 60);
  assert.equal(calls[0].input.weight, 7);
});

test("入力の確かめ: scope はカテゴリか <地区>.<名前>、weight は 1 以上の整数、sliding の bucketSeconds は 0 < b ≤ window、知らないカテゴリ", async () => {
  const { rl, calls } = setup();
  const fixed = { window: "fixed" as const, windowSeconds: 60, limit: 1 };
  await assert.rejects(rl.consumeRateLimit({ key: { scope: "bankTransferJudgeFail15m", identifier: "u" }, rule: fixed }), /scope/);
  await assert.rejects(rl.consumeRateLimit({ key: { scope: "a.b.c", identifier: "u" }, rule: fixed }), /scope/);
  await assert.rejects(rl.consumeRateLimit({ key: { scope: "x.y", identifier: "" }, rule: fixed }), /identifier/);
  await assert.rejects(rl.consumeRateLimit({ key: { scope: "x.y", identifier: "u" }, rule: fixed, weight: 0 }), /weight/);
  await assert.rejects(rl.consumeRateLimit({ key: { scope: "x.y", identifier: "u" }, rule: fixed, weight: 1.5 }), /weight/);
  await assert.rejects(rl.consumeRateLimit({ key: { scope: "x.y", identifier: "u" }, rule: { window: "sliding", windowSeconds: 60, bucketSeconds: 120, limit: 1 } }), /bucketSeconds/);
  await assert.rejects(rl.consumeRateLimit({ key: { scope: "x.y", identifier: "u" }, rule: "nope" }), /カテゴリ nope/);
  await assert.rejects(rl.consumeRateLimit({ key: { scope: "x.y", identifier: "u" }, rule: { window: "fixed", windowSeconds: 0, limit: 1 } }), /windowSeconds/);
  assert.equal(calls.length, 0, "確かめに落ちたら表に触れない");
  await rl.consumeRateLimit({ key: { scope: "rateLimit.judgeFail15m", identifier: "u" }, rule: fixed });
  assert.equal(calls.length, 1);
});
