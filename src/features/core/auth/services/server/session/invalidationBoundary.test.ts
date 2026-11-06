// src/features/core/auth/services/server/session/invalidationBoundary.test.ts
//
// Firebase の ID トークンをセッションに替えるとき、全セッション失効の境目(sessions_invalidated_at)より前に認証した
// トークンを拒む検査(DB・Firebase なし)。ログイン(createFirebaseSession)と本登録(register)の両方の道。
// - 境目より前の auth_time = 401、セッションを出さない(本登録はパスワードの書き換えにも進まない)
// - Firebase の取り消しが失敗した場合 = verifyIdToken(checkRevoked) が通っても、境目で止まる(上と同じ形)
// - 境目より後 / 境目が無い = 通る
// 実行: pnpm test:establish-session
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";

const BOUNDARY = new Date("2026-11-05T12:00:00Z");
const BOUNDARY_SECONDS = Math.floor(BOUNDARY.getTime() / 1000);

let authTime: number | undefined;
const firebaseCalls: string[] = [];
const issued: string[] = [];
let currentUser: Record<string, unknown> | null = null;

mock.module("@/lib/firebase/server/app", {
  namedExports: {
    // checkRevoked=true でも通る = Firebase の取り消しが失敗した(またはまだ届いていない)状態
    getServerAuth: () => ({
      verifyIdToken: async () => ({ uid: "provider-uid", auth_time: authTime }),
      updateUser: async () => void firebaseCalls.push("updateUser"),
    }),
  },
});
const chain = { from: () => chain, where: () => chain, limit: async () => (currentUser ? [currentUser] : []) };
mock.module("@/lib/drizzle", { namedExports: { db: { select: () => chain } } });
mock.module("@/features/core/user/services/server/userService", {
  namedExports: {
    userService: {
      updateLastAuthenticated: async () => {},
      findByProvider: async () => currentUser,
    },
  },
});
mock.module("@/lib/jwt", {
  namedExports: {
    SESSION_DEFAULT_MAX_AGE_SECONDS: 1000,
    signUserToken: async () => {
      issued.push("token");
      return { token: "t", expiresAt: new Date("2030-01-01T00:00:00Z") };
    },
  },
});
// 本登録の道の残り(境目を通った後の処理)は記録だけ
mock.module("@/features/core/user/services/server/registration", {
  namedExports: { registerFromAuth: async () => ({ user: { ...currentUser, status: "active" } }) },
});
mock.module("@/features/core/userProfile/services/server/userProfileService", { namedExports: { userProfileService: { upsertProfile: async () => {} } } });
mock.module("@/featureGate", { namedExports: { gate: { enabled: () => false } } });
mock.module("@/features/core/coupon/services/server/couponService", { namedExports: { couponService: {} } });
mock.module("@/features/core/userAcquisition/services/server", { namedExports: { recordSignupAcquisition: async () => {} } });
mock.module("./../postRegistrationMilestones", { namedExports: { runPostRegistrationMilestones: async () => {} } });

let createFirebaseSession: typeof import("../firebaseSession").createFirebaseSession;
let register: typeof import("../registration").register;
let isBeforeSessionInvalidation: typeof import("./invalidationBoundary").isBeforeSessionInvalidation;
before(async () => {
  ({ createFirebaseSession } = await import("../firebaseSession"));
  ({ register } = await import("../registration"));
  ({ isBeforeSessionInvalidation } = await import("./invalidationBoundary"));
});

beforeEach(() => {
  firebaseCalls.length = 0;
  issued.length = 0;
  mock.method(console, "error", () => {});
});

const user = (status: string, sessionsInvalidatedAt: Date | null) => ({
  id: "019a0000-0000-7000-8000-000000000003",
  role: "user",
  status,
  isDemo: false,
  providerType: "google.com",
  providerUid: "provider-uid",
  name: "はなこ",
  sessionsInvalidatedAt,
});
const loginInput = { providerType: "google.com", providerUid: "provider-uid", idToken: "id-token" };
const registerInput = { providerType: "google.com", providerUid: "provider-uid", idToken: "id-token", email: "h@example.test", name: "はなこ" };

const rejects401 = (promise: Promise<unknown>) =>
  assert.rejects(promise, (error: { status?: number }) => error.status === 401);

test("ログイン: 境目より前に認証したトークンは 401、セッションを出さない(Firebase の取り消しが失敗していても)", async () => {
  currentUser = user("active", BOUNDARY);
  authTime = BOUNDARY_SECONDS - 60;
  await rejects401(createFirebaseSession(loginInput));
  authTime = undefined; // auth_time の無いトークンも拒む側
  await rejects401(createFirebaseSession(loginInput));
  assert.deepEqual(issued, []);
});

test("ログイン: 境目より後(同じ秒を含む)・境目が無い = 通る", async () => {
  currentUser = user("active", BOUNDARY);
  authTime = BOUNDARY_SECONDS + 5;
  assert.equal((await createFirebaseSession(loginInput)).session.token, "t");
  authTime = BOUNDARY_SECONDS;
  assert.equal((await createFirebaseSession(loginInput)).session.token, "t");
  currentUser = user("active", null);
  authTime = BOUNDARY_SECONDS - 60;
  assert.equal((await createFirebaseSession(loginInput)).session.token, "t");
});

test("本登録: 境目より前に認証したトークンは 401、登録・セッションに進まない", async () => {
  currentUser = user("withdrawn", BOUNDARY);
  authTime = BOUNDARY_SECONDS - 60;
  await rejects401(register(registerInput));
  assert.deepEqual(issued, []);
  assert.deepEqual(firebaseCalls, []);
});

test("本登録: 境目より後に認証したトークンは通ってセッションを出す", async () => {
  currentUser = user("withdrawn", BOUNDARY);
  authTime = BOUNDARY_SECONDS + 5;
  const result = await register(registerInput);
  assert.equal(result.session.token, "t");
});

test("isBeforeSessionInvalidation: 秒に切り捨てて比べ、境目が無ければ false", () => {
  const at = new Date("2026-11-05T12:00:00.900Z");
  assert.equal(isBeforeSessionInvalidation(BOUNDARY_SECONDS - 1, at), true);
  assert.equal(isBeforeSessionInvalidation(BOUNDARY_SECONDS, at), false);
  assert.equal(isBeforeSessionInvalidation(0, null), false);
  assert.equal(isBeforeSessionInvalidation(0, undefined), false);
});
