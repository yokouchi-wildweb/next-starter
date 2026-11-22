// src/lib/routeFactory/noDevice.test.mts
// 「端末なし」(端末の束を渡さない = 点 routeFactoryDevice が空、D53)の回帰テスト。端末を差すドメインが閉じて門番が項目を外した間、
// createDeviceRoute のルートは端末として通らず閉じたまま失敗する(素通りしない)こと、束があれば今まで通りであること。
// 実際の Factory に、認証すれば必ず端末を返す束を渡す / 渡さないで動かす。
// 実行: pnpm test src/lib/routeFactory/noDevice.test.mts

import assert from "node:assert/strict";
import { mock, test } from "node:test";

import nextServer, { NextRequest } from "next/server";

// 入口の芯は最初に next/server の connection() を待つ。Next のリクエストの外(ここ)では throw するので、
// next/server は本物のまま connection だけ空にする(入口を読み込む前に置く)
mock.module("next/server", { namedExports: { ...nextServer, connection: async () => {} } });

const { createRouteFactories } = await import("./createRouteFactories.ts");

const DEVICE = { device: { deviceId: "d1", kind: "table_terminal", label: "T1", scope: {} }, tokenExpiresAt: new Date(Date.now() + 86_400_000) };

let authenticateCalls = 0;
let currentUser: { userId: string; role: string; status: string; isDemo: boolean } | null = null;

const deviceDeps = {
  authenticateRequestDevice: async () => {
    authenticateCalls += 1;
    return DEVICE as never;
  },
  syncPairedDeviceCookie: (response: never) => response,
  checkPairedDeviceRateLimit: async () => null,
  pairedDeviceErrorResponse: () => null,
};

const factoriesWith = (device: typeof deviceDeps | undefined) =>
  createRouteFactories<Record<string, unknown>, any, any, any>({
    rateLimit: { checkRateLimit: async () => ({ allowed: true, resetAt: new Date() }) },
    user: {
      resolveUser: async () => currentUser as never,
      resolveTokenSession: async () => null as never,
      evaluateAccess: (_rule, user) => (user ? "granted" : "unauthenticated"),
      availableStatuses: ["active"],
    },
    ...(device ? { device } : {}),
    domains: {},
  });

const withDevice = factoriesWith(deviceDeps);
const noDevice = factoriesWith(undefined);

const call = (route: (req: NextRequest, ctx: { params: Promise<object> }) => Promise<Response>) =>
  route(new NextRequest("http://localhost/api/test", { method: "POST" }), { params: Promise.resolve({}) });

test("端末の束があれば、端末として通ってハンドラに届く(今まで通り)", async () => {
  currentUser = null;
  authenticateCalls = 0;
  let principal: string | null = null;
  const route = withDevice.createDeviceRoute({ operation: "POST /api/test", operationType: "write" }, async (_req, ctx) => {
    principal = ctx.principal;
    return { ok: true };
  });
  const res = await call(route);
  assert.equal(res.status, 200);
  assert.equal(principal, "device");
  assert.equal(authenticateCalls, 1);
});

test("端末の束が無ければ(端末なし)、端末だけのルートは端末を認証せず 401 で失敗する(ハンドラに届かない)", async () => {
  currentUser = null;
  authenticateCalls = 0;
  let handled = 0;
  const route = noDevice.createDeviceRoute({ operation: "POST /api/test", operationType: "write" }, async () => {
    handled += 1;
    return { ok: true };
  });
  const res = await call(route);
  assert.equal(res.status, 401);
  assert.equal(handled, 0);
  assert.equal(authenticateCalls, 0, "端末なしの間は端末の束の認証を呼ばない(端末の表を読まない)");
});

test("端末の束が無ければ(端末なし)、orUser のルートは端末として通らず利用者の枝だけが動く", async () => {
  currentUser = { userId: "u1", role: "user", status: "active", isDemo: false };
  let principal: string | null = null;
  const route = noDevice.createDeviceRoute(
    { operation: "POST /api/test", operationType: "write", orUser: "authenticated" },
    async (_req, ctx) => {
      principal = ctx.principal;
      return { ok: true };
    },
  );
  const res = await call(route);
  assert.equal(res.status, 200);
  assert.equal(principal, "user");
  // 利用者もいなければ閉じたまま 401
  currentUser = null;
  const denied = await call(route);
  assert.equal(denied.status, 401);
});
