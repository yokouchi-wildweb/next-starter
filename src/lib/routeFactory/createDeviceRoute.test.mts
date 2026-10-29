// src/lib/routeFactory/createDeviceRoute.test.mts
// createDeviceRoute の主体判定の回帰テスト（端末認証・ユーザーの束を差し込んで実際のファクトリーを動かす）
// 実行: pnpm test:device-route

import assert from "node:assert/strict";
import { test } from "node:test";

import { NextRequest } from "next/server";

type FakeDevice = { deviceId: string; kind: string; label: string; scope: unknown };

let currentDevice: FakeDevice | null = null;
let currentUser: { userId: string; role: string; status: string; isDemo: boolean } | null = null;
let tokenOnlyIsDemo = false;

// 主体の解き方は束で差し込む（lib/routeFactory は auth・pairedDevice を import しない）
const { createRouteFactories } = await import("./createRouteFactories.ts");
const { createDeviceRoute } = createRouteFactories<string>({
  user: {
    resolveUser: async () => currentUser as never,
    resolveTokenSession: async () =>
      (tokenOnlyIsDemo ? { userId: "demo", role: "user", status: "active", isDemo: true } : null) as never,
    evaluateAccess: (_rule, user) => (user ? "granted" : "unauthenticated"),
    availableStatuses: ["active"],
  },
  device: {
    authenticateRequestDevice: async () =>
      (currentDevice ? { device: currentDevice, tokenExpiresAt: new Date(Date.now() + 86_400_000) } : null) as never,
    syncPairedDeviceCookie: (response) => {
      response.headers.set("x-test-cookie-synced", "1");
      return response;
    },
    checkPairedDeviceRateLimit: async () => null,
    pairedDeviceErrorResponse: () => null,
  },
  domains: {},
});

const call = (route: (req: NextRequest, ctx: { params: Promise<object> }) => Promise<Response>) =>
  route(new NextRequest("http://localhost/api/test", { method: "POST" }), { params: Promise.resolve({}) });

test("デモユーザーの Cookie があっても、端末として通った書き込みはハンドラまで届く", async () => {
  currentDevice = { deviceId: "d1", kind: "table_terminal", label: "T1", scope: {} };
  currentUser = null;
  tokenOnlyIsDemo = true;
  let handled = 0;
  const route = createDeviceRoute({ operation: "POST /api/test", operationType: "write" }, async () => {
    handled += 1;
    return { ok: true };
  });
  const res = await call(route);
  assert.equal(handled, 1);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(res.headers.get("x-test-cookie-synced"), "1", "端末への応答は Cookie を書き直す");
});

test("orUser の user 枝では、デモユーザーの書き込みは従来どおりスキップされる", async () => {
  currentDevice = null;
  currentUser = { userId: "u1", role: "admin", status: "active", isDemo: true };
  tokenOnlyIsDemo = true;
  let handled = 0;
  const route = createDeviceRoute(
    { operation: "POST /api/test", operationType: "write", orUser: "authenticated" },
    async () => {
      handled += 1;
      return { ok: true };
    },
  );
  const res = await call(route);
  assert.equal(handled, 0);
  assert.deepEqual(await res.json(), { success: true, demo: true });
});

test("端末の応答はハンドラのエラーでも Cookie を書き直す", async () => {
  currentDevice = { deviceId: "d1", kind: "table_terminal", label: "T1", scope: {} };
  currentUser = null;
  tokenOnlyIsDemo = false;
  const { DomainError } = await import("@/lib/errors");
  const route = createDeviceRoute({ operation: "POST /api/test", operationType: "write" }, async () => {
    throw new DomainError("だめ", { status: 409 });
  });
  const res = await call(route);
  assert.equal(res.status, 409);
  assert.equal(res.headers.get("x-test-cookie-synced"), "1");
});

test("端末でもユーザーでもなければ 401", async () => {
  currentDevice = null;
  currentUser = null;
  tokenOnlyIsDemo = false;
  const route = createDeviceRoute({ operation: "POST /api/test", operationType: "write" }, async () => ({}));
  const res = await call(route);
  assert.equal(res.status, 401);
});

test("DomainError 以外の例外は内部の文言を返さず、汎用メッセージの 500 にする（createApiRoute 共通の catch）", async () => {
  currentDevice = { deviceId: "d1", kind: "table_terminal", label: "T1", scope: {} };
  currentUser = null;
  tokenOnlyIsDemo = false;
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const route = createDeviceRoute({ operation: "POST /api/test", operationType: "write" }, async () => {
      throw new Error('relation "users" does not exist: SELECT local_password FROM users');
    });
    const res = await call(route);
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.message, "サーバーでエラーが発生しました");
    assert.doesNotMatch(JSON.stringify(body), /local_password|SELECT/);
  } finally {
    console.error = originalConsoleError;
  }
});
