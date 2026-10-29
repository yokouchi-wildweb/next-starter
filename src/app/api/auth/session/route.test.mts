// src/app/api/auth/session/route.test.mts
// GET /api/auth/session の再発行が DB 照合 (強制失効・現在の role/status) を通ることの回帰テスト
// （DB のユーザー取得と next/headers の Cookie だけをモックし、実際の JWT 署名・検証とルートファクトリーを動かす）
// 実行: pnpm test:auth-session-refresh

import assert from "node:assert/strict";
import { mock, test } from "node:test";

import { NextRequest } from "next/server";

process.env.AUTH_JWT_SECRET = "test-secret-for-auth-session-refresh";

type FakeDbUser = {
  id: string;
  role: string;
  status: string;
  isDemo: boolean;
  providerType: string;
  providerUid: string;
  name: string | null;
  sessionsInvalidatedAt: Date | null;
};

let dbUser: FakeDbUser | null = null;
// Factory は next/headers の cookies() から利用者を解く。テストではリクエストの Cookie をここに置いて渡す
let requestCookie: string | null = null;

mock.module("@/features/core/user/services/server/finders/findUserById", {
  namedExports: { findUserById: async (id: string) => (dbUser && dbUser.id === id ? dbUser : null) },
});
mock.module("@/features/core/auth/services/server/session/getTokenOnlySession", {
  namedExports: { getTokenOnlySession: async () => null },
});
mock.module("next/headers", {
  namedExports: {
    cookies: async () => ({
      get: (name: string) => {
        if (!requestCookie) return undefined;
        const [key, ...rest] = requestCookie.split("=");
        return key === name ? { name, value: rest.join("=") } : undefined;
      },
    }),
  },
});
mock.module("@/features/core/rateLimit/services/server/wrappers/rateLimitHelper", {
  namedExports: { checkRateLimit: async () => ({ allowed: true }) },
});

const { signUserToken, verifyUserToken, SESSION_DEFAULT_MAX_AGE_SECONDS } = await import("@/lib/jwt");
const { APP_FEATURES } = await import("@/config/app/app-features.config");
const { AUTH_SESSION_COOKIE_NAME } = await import("@/features/core/auth/constants/session");
const { GET } = await import("./route.ts");

const baseUser = (): FakeDbUser => ({
  id: "u1",
  role: "user",
  status: "active",
  isDemo: false,
  providerType: "email",
  providerUid: "uid-1",
  name: "taro",
  sessionsInvalidatedAt: null,
});

async function tokenFor(claims: Partial<FakeDbUser>, issuedAt?: Date): Promise<string> {
  const user = { ...baseUser(), ...claims };
  const { token } = await signUserToken({
    subject: user.id,
    claims: {
      role: user.role,
      status: user.status,
      isDemo: user.isDemo,
      providerType: user.providerType,
      providerUid: user.providerUid,
      name: user.name,
    },
    options: issuedAt ? { issuedAt } : undefined,
  });
  return token;
}

const call = (token: string) => {
  requestCookie = `${AUTH_SESSION_COOKIE_NAME}=${token}`;
  return GET(
    new NextRequest("http://localhost/api/auth/session", {
      headers: { cookie: `${AUTH_SESSION_COOKIE_NAME}=${token}` },
    }),
    { params: Promise.resolve({}) },
  );
};

const sessionCookieOf = (res: Response) => {
  const header = res.headers.getSetCookie().find((c) => c.startsWith(`${AUTH_SESSION_COOKIE_NAME}=`));
  assert.ok(header, "セッション Cookie が Set-Cookie に含まれる");
  const value = header.slice(AUTH_SESSION_COOKIE_NAME.length + 1).split(";")[0];
  const maxAge = Number(/Max-Age=(\d+)/i.exec(header)?.[1]);
  return { value, maxAge };
};

test("強制失効より前に発行されたトークンは 401 になり、Cookie が消される", async () => {
  dbUser = { ...baseUser(), sessionsInvalidatedAt: new Date() };
  const token = await tokenFor({}, new Date(Date.now() - 60_000));
  const res = await call(token);
  assert.equal(res.status, 401);
  const cookie = sessionCookieOf(res);
  assert.equal(cookie.value, "");
  assert.equal(cookie.maxAge, 0);
});

test("Cookie が無ければ 401「セッションが見つかりません」", async () => {
  requestCookie = null;
  const res = await GET(new NextRequest("http://localhost/api/auth/session"), { params: Promise.resolve({}) });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).message, "セッションが見つかりません");
});

test("休会中の利用者のセッションも status を問わず再発行される（全 status を通す宣言）", async () => {
  dbUser = { ...baseUser(), status: "inactive" };
  const res = await call(await tokenFor({ status: "inactive" }));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).user.status, "inactive");
});

test("DB にユーザーが存在しないトークンは 401 になる", async () => {
  dbUser = null;
  const res = await call(await tokenFor({}));
  assert.equal(res.status, 401);
  assert.equal(sessionCookieOf(res).value, "");
});

test("再発行トークンとレスポンスは旧トークンのクレームではなく DB の現在値で作られる", async () => {
  dbUser = { ...baseUser(), role: "admin", status: "suspended", name: "renamed" };
  const res = await call(await tokenFor({ role: "user", status: "active", name: "taro" }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.user.role, "admin");
  assert.equal(body.user.status, "suspended");
  assert.equal(body.user.name, "renamed");

  const cookie = sessionCookieOf(res);
  assert.equal(cookie.maxAge, SESSION_DEFAULT_MAX_AGE_SECONDS);
  const verified = await verifyUserToken(cookie.value);
  assert.ok(verified);
  assert.equal(verified.claims.role, "admin");
  assert.equal(verified.claims.status, "suspended");
  assert.equal(verified.claims.name, "renamed");
  assert.equal(new Date(body.session.expiresAt).getTime(), verified.expiresAt.getTime());
});

test("デモユーザーは短いセッション時間のまま再発行される", async () => {
  dbUser = { ...baseUser(), isDemo: true };
  const res = await call(await tokenFor({ isDemo: true }));
  assert.equal(res.status, 200);
  assert.equal(sessionCookieOf(res).maxAge, APP_FEATURES.auth.session.demoMaxAgeSeconds);
});
