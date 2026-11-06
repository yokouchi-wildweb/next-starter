// src/features/core/auth/services/server/firebaseSession.lastAuth.test.ts
//
// メール / OAuth のログイン(createFirebaseSession)の最終ログインの更新の検査(DB・Firebase なし)。
// 他のログインと同じ userService.updateLastAuthenticated(ip)を使う(user_login_events の記録・ロックアウトの数の解除)。
// 拒否(403)なら呼ばない。トークンは通常の maxAge
// 実行: pnpm test src/features/core/auth/services/server/firebaseSession.lastAuth.test.ts
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";

const calls: string[] = [];
let currentUser: Record<string, unknown> | null = null;

mock.module("@/lib/firebase/server/app", {
  namedExports: {
    getServerAuth: () => ({ verifyIdToken: async () => ({ uid: "provider-uid" }) }),
  },
});
// db.select(...).from(...).where(...).limit(1) → [currentUser]
const chain = { from: () => chain, where: () => chain, limit: async () => (currentUser ? [currentUser] : []) };
mock.module("@/lib/drizzle", { namedExports: { db: { select: () => chain } } });
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
    signUserToken: async () => ({ token: "t", expiresAt: new Date("2030-01-01T00:00:00Z") }),
  },
});

let createFirebaseSession: typeof import("./firebaseSession").createFirebaseSession;
before(async () => {
  ({ createFirebaseSession } = await import("./firebaseSession"));
});

beforeEach(() => {
  calls.length = 0;
  mock.method(console, "error", () => {});
});

const row = (status: string) => ({
  id: "019a0000-0000-7000-8000-000000000002",
  role: "user",
  status,
  isDemo: false,
  providerType: "email",
  providerUid: "provider-uid",
  name: "はなこ",
});
const input = { providerType: "email", providerUid: "provider-uid", idToken: "id-token", ip: "198.51.100.7" };

test("許可: updateLastAuthenticated(ip)を呼び、通常の maxAge のトークン", async () => {
  currentUser = row("active");
  const result = await createFirebaseSession(input);
  assert.deepEqual(calls, [`lastAuth:${row("active").id}:198.51.100.7`]);
  assert.equal(result.session.maxAge, 1000);
  assert.equal(result.requiresReactivation, false);
  currentUser = row("inactive");
  assert.equal((await createFirebaseSession(input)).requiresReactivation, true);
});

test("拒否(withdrawn・security_locked)は最終ログインを更新しない", async () => {
  for (const status of ["withdrawn", "security_locked"]) {
    currentUser = row(status);
    await assert.rejects(createFirebaseSession(input));
  }
  assert.deepEqual(calls, []);
});
