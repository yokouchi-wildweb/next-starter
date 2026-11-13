// src/features/core/auth/services/server/marketingConsent.test.ts
// 会員登録の宣伝の同意の検査(messaging の書き込みは偽物)
// - false → 宣伝の種別まるごとの停止を source signup で書く / true → 前の試みの行を消す / 省略 → 何もしない / 書けなければ投げる
// 実行: pnpm test src/features/core/auth/services/server/marketingConsent.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { recordSignupMarketingConsent } from "./marketingConsent";

function setup(fail = false) {
  const calls: unknown[][] = [];
  const deps = {
    setPreference: async (...args: unknown[]) => {
      calls.push(args);
      if (fail) throw new Error("db down");
    },
  };
  return { calls, deps };
}

test("同意しない(false)= 宣伝の種別まるごとの停止を source signup で書く", async () => {
  const { calls, deps } = setup();
  await recordSignupMarketingConsent("u1", false, deps);
  assert.deepEqual(calls, [["u1", { kind: "marketing", optedOut: true }, { source: "signup" }]]);
});

test("同意する(true)= 前の試みが残した種別まるごとの行を消す", async () => {
  const { calls, deps } = setup();
  await recordSignupMarketingConsent("u1", true, deps);
  assert.deepEqual(calls, [["u1", { kind: "marketing", optedOut: false }, { source: "signup" }]]);
});

test("値が無ければ何もしない", async () => {
  const { calls, deps } = setup();
  await recordSignupMarketingConsent("u1", undefined, deps);
  assert.equal(calls.length, 0);
});

test("書けなければ投げる(登録は有効化の前で止まる)", async () => {
  const { deps } = setup(true);
  await assert.rejects(recordSignupMarketingConsent("u1", false, deps), /db down/);
});
