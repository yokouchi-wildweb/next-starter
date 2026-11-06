// src/wiring/apiRoute.test.mts
// 端末の束と門番の結線(gateDeviceDeps)の回帰テスト。端末の機能(pairedDevice)が閉じている間、
// createDeviceRoute のルートは端末として通らず閉じたまま失敗する(素通りしない)こと、開いていれば今まで通りであること。
// 実際の Factory(lib/routeFactory の createRouteFactories)に、認証すれば必ず端末を返す束を差し込んで動かす。
// 実行: pnpm test src/wiring/apiRoute.test.mts

import assert from "node:assert/strict";
import { test } from "node:test";

import { NextRequest } from "next/server";

const { createRouteFactories } = await import("@/lib/routeFactory");
const { gateDeviceDeps } = await import("./apiRoute.ts");

const DEVICE = { device: { deviceId: "d1", kind: "table_terminal", label: "T1", scope: {} }, tokenExpiresAt: new Date(Date.now() + 86_400_000) };

let open = true;
let authenticateCalls = 0;
let currentUser: { userId: string; role: string; status: string; isDemo: boolean } | null = null;

const deviceDeps = gateDeviceDeps(
  {
    authenticateRequestDevice: async () => {
      authenticateCalls += 1;
      return DEVICE as never;
    },
    syncPairedDeviceCookie: (response) => response,
    checkPairedDeviceRateLimit: async () => null,
    pairedDeviceErrorResponse: () => null,
  },
  () => open,
);

const { createDeviceRoute } = createRouteFactories<Record<string, unknown>, any, any, any>({
  rateLimit: { checkRateLimit: async () => ({ allowed: true, resetAt: new Date() }) },
  user: {
    resolveUser: async () => currentUser as never,
    resolveTokenSession: async () => null as never,
    evaluateAccess: (_rule, user) => (user ? "granted" : "unauthenticated"),
    availableStatuses: ["active"],
  },
  device: deviceDeps,
  domains: {},
});

const call = (route: (req: NextRequest, ctx: { params: Promise<object> }) => Promise<Response>) =>
  route(new NextRequest("http://localhost/api/test", { method: "POST" }), { params: Promise.resolve({}) });

test("端末の機能が開いていれば、端末として通ってハンドラに届く(今まで通り)", async () => {
  open = true;
  currentUser = null;
  authenticateCalls = 0;
  let principal: string | null = null;
  const route = createDeviceRoute({ operation: "POST /api/test", operationType: "write" }, async (_req, ctx) => {
    principal = ctx.principal;
    return { ok: true };
  });
  const res = await call(route);
  assert.equal(res.status, 200);
  assert.equal(principal, "device");
  assert.equal(authenticateCalls, 1);
});

test("端末の機能が閉じていれば、端末だけのルートは端末を認証せず 401 で失敗する(ハンドラに届かない)", async () => {
  open = false;
  currentUser = null;
  authenticateCalls = 0;
  let handled = 0;
  const route = createDeviceRoute({ operation: "POST /api/test", operationType: "write" }, async () => {
    handled += 1;
    return { ok: true };
  });
  const res = await call(route);
  assert.equal(res.status, 401);
  assert.equal(handled, 0);
  assert.equal(authenticateCalls, 0, "閉じている間は端末の束の認証を呼ばない(端末の表を読まない)");
});

test("端末の機能が閉じていれば、orUser のルートは端末として通らず利用者の枝だけが動く", async () => {
  open = false;
  currentUser = { userId: "u1", role: "user", status: "active", isDemo: false };
  let principal: string | null = null;
  const route = createDeviceRoute(
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
