// scripts/operations/deploy/lib.test.ts — pnpm test scripts/operations/deploy
// 本番のデプロイのセーフポイントの止め: --allow-unsafe=<理由> の読み方と guardSafePoint の分かれ方(判定は差し替える。git も vercel も触らない)

import assert from "node:assert/strict";
import { test } from "node:test";

import { allowUnsafeArgs, guardSafePoint, parseAllowUnsafe } from "./lib";

test("parseAllowUnsafe: 無ければ null、理由は取り出して他の引数は順に残す、旗だけ・空の理由は error", () => {
  assert.deepEqual(parseAllowUnsafe(["--prod"]), { reason: null, rest: ["--prod"], error: null });
  assert.deepEqual(parseAllowUnsafe(["--target=preview", "--allow-unsafe=急ぎ", "--confirm=production"]), {
    reason: "急ぎ",
    rest: ["--target=preview", "--confirm=production"],
    error: null,
  });
  assert.match(parseAllowUnsafe(["--allow-unsafe"]).error ?? "", /理由が空/);
  assert.match(parseAllowUnsafe(["--allow-unsafe=  "]).error ?? "", /理由が空/);
});

test("allowUnsafeArgs: 理由が無ければ空、あれば 1 つ", () => {
  assert.deepEqual(allowUnsafeArgs(null), []);
  assert.deepEqual(allowUnsafeArgs("急ぎ"), ["--allow-unsafe=急ぎ"]);
});

function harness(verdict: { ok: boolean; line: string; message: string }) {
  const calls = { verdict: 0, logs: [] as string[], errors: [] as string[], exits: [] as number[] };
  const deps = {
    verdict: () => {
      calls.verdict += 1;
      return verdict;
    },
    log: (s: string) => calls.logs.push(s),
    error: (s: string) => calls.errors.push(s),
    exit: ((code: number) => {
      calls.exits.push(code);
    }) as (code: number) => never,
  };
  return { calls, deps };
}

test("guardSafePoint: プレビューは判定しない、ok は通す、外れて理由なしは exit(1)、理由があれば理由を出して通す", () => {
  const bad = { ok: false, line: "before safe/next-starter/20261110-1", message: "本番に出せません: 違う" };

  const preview = harness(bad);
  guardSafePoint(false, null, preview.deps);
  assert.equal(preview.calls.verdict, 0);

  const ok = harness({ ok: true, line: "at safe/next-starter/20261110-1", message: "セーフポイント safe/next-starter/20261110-1 の上にいます" });
  guardSafePoint(true, null, ok.deps);
  assert.deepEqual(ok.calls.exits, []);
  assert.deepEqual(ok.calls.logs, ["✓ セーフポイント safe/next-starter/20261110-1 の上にいます"]);

  const refused = harness(bad);
  guardSafePoint(true, null, refused.deps);
  assert.deepEqual(refused.calls.exits, [1]);
  assert.deepEqual(refused.calls.errors, ["✗ 本番に出せません: 違う"]);

  const allowed = harness(bad);
  guardSafePoint(true, "急ぎ", allowed.deps);
  assert.deepEqual(allowed.calls.exits, []);
  assert.match(allowed.calls.errors.join("\n"), /--allow-unsafe\): 急ぎ/);
  assert.match(allowed.calls.errors.join("\n"), /本番に出せません: 違う/);
});
