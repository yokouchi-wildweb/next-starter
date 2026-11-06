// src/features/core/auth/services/server/localLogin.firebase.test.ts
//
// 管理者のローカルログイン(localLogin)は Firebase なしで完了する検査(DB・Firebase なし)。
// - Firebase のサーバー側が未設定: カスタムトークンを作らず firebaseCustomToken: null、セッションは出る
// - 設定済み: 今まで通りカスタムトークンを作る(uid = セッションの userId、claims { admin: true })
// 実行: pnpm test:local-login
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";

let firebaseConfigured = false;
const customTokenCalls: Array<{ uid: string; claims: unknown }> = [];
mock.module("@/lib/firebase/server/app", {
  namedExports: {
    isFirebaseServerConfigured: () => firebaseConfigured,
    getServerAuth: () => {
      if (!firebaseConfigured) throw new Error("FirebaseNotConfiguredError(server)");
      return {
        createCustomToken: async (uid: string, claims: unknown) => {
          customTokenCalls.push({ uid, claims });
          return `custom-${uid}`;
        },
      };
    },
  },
});

const admin = {
  id: "u-admin",
  role: "admin",
  status: "active",
  email: "a@example.test",
  localPassword: "hash",
  lockedUntil: null,
  failedLoginCount: 0,
  providerUid: "a@example.test",
};
mock.module("@/features/core/user/services/server/userService", {
  namedExports: {
    userService: {
      findByLocalEmail: async () => admin,
      checkLockState: () => ({ kind: "none" }),
      updateLastAuthenticated: async () => {},
      recordFailedLogin: async () => ({ kind: "none" }),
    },
    formatShortLockMessage: () => "locked",
    PERMANENT_LOCK_MESSAGE: "permanent",
  },
});
mock.module("@/features/core/user/constants", { namedExports: { getRoleCategory: (role: string) => (role === "admin" ? "admin" : "user") } });
mock.module("@/features/core/auth/utils/password", { namedExports: { verifyPassword: async () => true } });
mock.module("@/features/core/auditLog/services/server", { namedExports: { auditLogger: { record: async () => {} } } });
mock.module("@/features/core/auth/mail/AccountLockedEmail", { namedExports: { AccountLockedEmail: { send: async () => {} } } });
mock.module("./loginAudit", { namedExports: { recordLoginFailure: async () => {} } });
mock.module("./sessionInvalidation", { namedExports: { invalidateSessionsForUser: async () => {} } });
mock.module("./session/sessionToken", {
  namedExports: {
    issueSessionToken: async (user: { id: string }) => ({
      sessionUser: { userId: user.id },
      token: "jwt",
      expiresAt: new Date("2030-01-01T00:00:00Z"),
      maxAge: 1000,
    }),
  },
});
mock.module("@/lib/jwt", { namedExports: { SESSION_DEFAULT_MAX_AGE_SECONDS: 1000 } });

let localLogin: typeof import("./localLogin").localLogin;
before(async () => {
  ({ localLogin } = await import("./localLogin"));
});
beforeEach(() => {
  customTokenCalls.length = 0;
});

test("Firebase のサーバー側が未設定: カスタムトークンを作らず null を返し、セッションは出る", async () => {
  firebaseConfigured = false;
  const result = await localLogin({ email: "a@example.test", password: "pw" });
  assert.equal(result.firebaseCustomToken, null);
  assert.equal(result.session.token, "jwt");
  assert.equal(result.user.userId, "u-admin");
  assert.deepEqual(customTokenCalls, []);
});

test("Firebase 設定済み: 今まで通りカスタムトークンを作る(uid = userId、claims { admin: true })", async () => {
  firebaseConfigured = true;
  const result = await localLogin({ email: "a@example.test", password: "pw" });
  assert.equal(result.firebaseCustomToken, "custom-u-admin");
  assert.deepEqual(customTokenCalls, [{ uid: "u-admin", claims: { admin: true } }]);
});
