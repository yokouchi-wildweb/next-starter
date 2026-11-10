// src/features/core/auth/services/server/session/establishSession.test.ts
//
// セッションを出す口(establishSession)と部品(assertSessionStatus / issueSessionToken)の検査(DB・秘密鍵なし)。
// - 状態の分岐: security_locked・pending・withdrawn は 403、inactive は復帰の印、他は許可
// - issueSessionToken: クレームは DB の値から、maxAge の既定は isDemo でデモ / 通常、明示すればその値
// - establishSession: 拒否なら最終ログインも cookie も書かない。許可なら 最終ログイン(ip)→ 署名 → cookie の順
// 実行: pnpm test src/features/core/auth/services/server/session/establishSession.test.ts
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";

import { DomainError } from "@/lib/errors";

const calls: string[] = [];
const signed: Array<{ subject: string; claims: Record<string, unknown>; options: { maxAge: number } }> = [];

mock.module("@/features/core/user/services/server/userService", {
  namedExports: {
    userService: {
      updateLastAuthenticated: async (userId: string, options?: { ip?: string }) => {
        calls.push(`lastAuth:${userId}:${options?.ip ?? "-"}`);
      },
    },
  },
});
mock.module("@/lib/jwt", {
  namedExports: {
    SESSION_DEFAULT_MAX_AGE_SECONDS: 1000,
    signUserToken: async (input: (typeof signed)[number]) => {
      calls.push("sign");
      signed.push(input);
      return { token: `token-${input.subject}`, expiresAt: new Date("2030-01-01T00:00:00Z") };
    },
  },
});

let m: typeof import("./establishSession");
let demoMaxAge: number;
before(async () => {
  m = await import("./establishSession");
  demoMaxAge = (await import("@/features/core/demo/config")).demoConfig.session.maxAgeSeconds;
});

beforeEach(() => {
  calls.length = 0;
  signed.length = 0;
});

const user = (status: string, isDemo = false) => ({
  id: "019a0000-0000-7000-8000-000000000001",
  role: "user",
  status,
  isDemo,
  providerType: "line",
  providerUid: "U123",
  name: "たろう",
});

const cookieJar = () => {
  const set: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  return {
    set,
    cookies: {
      set: (name: string, value: string, options: Record<string, unknown>) => {
        calls.push("cookie");
        set.push({ name, value, options });
      },
    } as never,
  };
};

test("状態の分岐: security_locked・pending・withdrawn は 403、inactive は復帰の印", () => {
  for (const status of ["security_locked", "pending", "withdrawn"]) {
    assert.throws(
      () => m.assertSessionStatus({ status }),
      (error: unknown) => error instanceof DomainError && error.status === 403,
      status,
    );
  }
  assert.deepEqual(m.assertSessionStatus({ status: "inactive" }), { requiresReactivation: true });
  for (const status of ["active", "suspended", "banned"]) {
    assert.deepEqual(m.assertSessionStatus({ status }), { requiresReactivation: false }, status);
  }
});

test("issueSessionToken: クレームは DB の値、maxAge の既定は isDemo で決まり、明示すればその値", async () => {
  const normal = await m.issueSessionToken(user("active"));
  assert.equal(normal.maxAge, 1000);
  assert.equal(normal.sessionUser.userId, user("active").id);
  assert.deepEqual(signed[0]?.claims, {
    role: "user",
    status: "active",
    isDemo: false,
    providerType: "line",
    providerUid: "U123",
    name: "たろう",
  });
  // デモの短い時間はデモのログインの機能 demoLogin が開のときだけ(上流の既定は閉、D115)。閉なら通常の長さ
  const { overrideSwitches } = await import("@/featureGate/ruleList");
  const restore = overrideSwitches({ demoLogin: true });
  try {
    assert.equal((await m.issueSessionToken(user("active", true))).maxAge, demoMaxAge);
  } finally {
    restore();
  }
  const closed = overrideSwitches({ demoLogin: false });
  try {
    assert.equal((await m.issueSessionToken(user("active", true))).maxAge, 1000);
  } finally {
    closed();
  }
  assert.equal((await m.issueSessionToken(user("active", true), { maxAge: 1000 })).maxAge, 1000);
});

test("establishSession: 拒否なら最終ログインも cookie も書かない", async () => {
  const jar = cookieJar();
  await assert.rejects(m.establishSession({ cookies: jar.cookies, user: user("withdrawn"), ip: "203.0.113.1" }));
  assert.deepEqual(calls, []);
  assert.equal(jar.set.length, 0);
});

test("establishSession: 許可なら 最終ログイン(ip)→ 署名 → cookie の順", async () => {
  const jar = cookieJar();
  const result = await m.establishSession({ cookies: jar.cookies, user: user("inactive"), ip: "203.0.113.1" });
  assert.deepEqual(calls, [`lastAuth:${user("x").id}:203.0.113.1`, "sign", "cookie"]);
  assert.equal(result.requiresReactivation, true);
  assert.equal(result.sessionUser.status, "inactive");
  assert.equal(jar.set[0]?.value, `token-${user("x").id}`);
  assert.equal(jar.set[0]?.options.maxAge, 1000);
});
