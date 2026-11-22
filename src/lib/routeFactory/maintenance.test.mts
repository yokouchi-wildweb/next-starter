// src/lib/routeFactory/maintenance.test.mts
// メンテナンス中、全 Factory の土台が書き込みのメソッドだけを 503 + code "maintenance" で止めること。
// 実行: pnpm test src/lib/routeFactory/maintenance.test.mts
import assert from "node:assert/strict";
import { mock, test } from "node:test";

import nextServer, { NextRequest } from "next/server";

// 入口の芯は最初に next/server の connection() を待つ。Next のリクエストの外(ここ)では throw するので空にする
mock.module("next/server", { namedExports: { ...nextServer, connection: async () => {} } });

const { createRouteFactories } = await import("./createRouteFactories.ts");
const { MAINTENANCE_CODE } = await import("./maintenance.ts");

type User = { userId: string; role: string; status: string; isDemo: boolean };

const admin: User = { userId: "a1", role: "admin", status: "active", isDemo: false };
const suspendedAdmin: User = { ...admin, status: "suspended" };
const member: User = { userId: "u1", role: "user", status: "active", isDemo: false };

function factories(opts: { active: boolean; user: User | null; counter?: { isActive: number; resolveUser: number } }) {
  const counter = opts.counter ?? { isActive: 0, resolveUser: 0 };
  return createRouteFactories<Record<string, unknown>, any, any, any>({
    rateLimit: { checkRateLimit: async () => ({ allowed: true, resetAt: new Date() }) },
    user: {
      resolveUser: async () => {
        counter.resolveUser += 1;
        return opts.user;
      },
      resolveTokenSession: async () => null,
      evaluateAccess: () => "granted",
      availableStatuses: ["active"],
    },
    device: {
      authenticateRequestDevice: async () => null,
      syncPairedDeviceCookie: (response) => response,
      checkPairedDeviceRateLimit: async () => null,
      pairedDeviceErrorResponse: () => null,
    },
    // 汎用 CRUD の行は認可(登録表の行・access・空のサービス)を通るだけの形
    domains: { x: { service: async () => ({}) as never, access: { read: "public", write: "public" }, table: "x", idColumn: "id" } } as never,
    maintenance: {
      isActive: async () => {
        counter.isActive += 1;
        return opts.active;
      },
      canBypass: (user: User | null) => user?.role === "admin",
    },
  });
}

const call = (route: (req: NextRequest, ctx: { params: Promise<object> }) => Promise<Response>, method: string) =>
  route(new NextRequest("http://localhost/api/x", { method }), { params: Promise.resolve({}) });

const ok = async () => ({ done: true });

test("期間中、書き込みのメソッド(POST・PUT・PATCH・DELETE)は 503 + code maintenance で止まり、ハンドラは呼ばれない", async () => {
  let called = 0;
  const route = factories({ active: true, user: member }).createApiRoute(
    { operation: "x", operationType: "write", access: "public" },
    async () => {
      called += 1;
      return { done: true };
    },
  );
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const res = await call(route, method);
    assert.equal(res.status, 503, method);
    const body = await res.json();
    assert.equal(body.code, MAINTENANCE_CODE);
    assert.equal(typeof body.message, "string");
  }
  assert.equal(called, 0);
});

test("GET・HEAD・OPTIONS は期間を読まずに通る", async () => {
  const counter = { isActive: 0, resolveUser: 0 };
  const route = factories({ active: true, user: member, counter }).createApiRoute(
    { operation: "x", operationType: "read", access: "public", user: "skip" },
    ok,
  );
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    assert.equal((await call(route, method)).status, 200, method);
  }
  assert.equal(counter.isActive, 0);
});

test("期間の外は書き込みも通る", async () => {
  const route = factories({ active: false, user: member }).createApiRoute(
    { operation: "x", operationType: "write", access: "public" },
    ok,
  );
  assert.equal((await call(route, "POST")).status, 200);
});

test("バイパスできる利用者(管理者)は通り、利用できない status の管理者は止まる", async () => {
  const config = { operation: "x", operationType: "write", access: "authenticated" } as const;
  assert.equal((await call(factories({ active: true, user: admin }).createApiRoute(config, ok), "POST")).status, 200);
  // 認可は通す束(evaluateAccess = granted)でも、バイパスは利用できる status の利用者だけ(proxy と同じ)
  assert.equal(
    (await call(factories({ active: true, user: suspendedAdmin }).createApiRoute(config, ok), "POST")).status,
    503,
  );
});

test('maintenance: "pass" を宣言したルートは期間中も通り、期間を読まない', async () => {
  const counter = { isActive: 0, resolveUser: 0 };
  const route = factories({ active: true, user: member, counter }).createApiRoute(
    { operation: "x", operationType: "write", access: "public", maintenance: "pass" },
    ok,
  );
  assert.equal((await call(route, "POST")).status, 200);
  assert.equal(counter.isActive, 0);
});

test('user: "skip" のルートはバイパスにも利用者を解かない(管理者の Cookie でも止まる)', async () => {
  const counter = { isActive: 0, resolveUser: 0 };
  const route = factories({ active: true, user: admin, counter }).createApiRoute(
    { operation: "x", operationType: "write", access: "public", user: "skip" },
    ok,
  );
  assert.equal((await call(route, "POST")).status, 503);
  assert.equal(counter.resolveUser, 0);
});

test("本人専用・汎用 CRUD・端末の Factory も同じ土台で止まる", async () => {
  const f = factories({ active: true, user: member });
  const me = f.createMeRoute({ operation: "me", operationType: "write" }, ok);
  assert.equal((await call(me, "POST")).status, 503);
  const domain = f.createDomainRoute({ operation: "d", operationType: "write", crudOp: "create" }, ok);
  assert.equal(
    (await domain(new NextRequest("http://localhost/api/x", { method: "POST" }), { params: Promise.resolve({ domain: "x" }) })).status,
    503,
  );
  const device = f.createDeviceRoute({ operation: "dev", operationType: "write" }, ok);
  assert.equal((await call(device, "POST")).status, 503);
});

test("口の無い束はメンテナンスで止めない(今の通り)", async () => {
  const f = createRouteFactories<Record<string, unknown>, any, any, any>({
    rateLimit: { checkRateLimit: async () => ({ allowed: true, resetAt: new Date() }) },
    user: {
      resolveUser: async () => member,
      resolveTokenSession: async () => null,
      evaluateAccess: () => "granted",
      availableStatuses: ["active"],
    },
    device: {
      authenticateRequestDevice: async () => null,
      syncPairedDeviceCookie: (response) => response,
      checkPairedDeviceRateLimit: async () => null,
      pairedDeviceErrorResponse: () => null,
    },
    domains: {},
  });
  const route = f.createApiRoute({ operation: "x", operationType: "write", access: "public" }, ok);
  assert.equal((await call(route, "POST")).status, 200);
});
