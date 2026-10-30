// src/lib/routeFactory/createApiRoute.test.mts
// 汎用 Factory の契約の回帰テスト（利用者の束を差し込んで実際のファクトリーを動かす。DB は使わない）。
// - 主体はリクエストごとに 1 回だけ解き、全 access で ctx.user に渡す（public は利用可能な status のときだけ）
// - allowStatuses（fail-closed）・拒否の body の code と {domain, operation}・素の Response の素通し・DomainError の code/details・形の外の access は 500
// 実行: pnpm test:route-factory

import assert from "node:assert/strict";
import { test } from "node:test";

import { NextRequest } from "next/server";

import { evaluateApiAccessRule } from "@/features/core/auth/services/server/apiAccess";
// `export *` だけの index.ts は tsx の ESM 読み込みで名前を拾えないので、実装ファイルを直接読む
import { DomainError } from "@/lib/errors/domainError";

import { createRouteFactories } from "./createRouteFactories.ts";

type FakeUser = { userId: string; role: string; status: string; isDemo: boolean };
let currentUser: FakeUser | null = null;
let resolveCount = 0;

const ownerService = { ping: async () => "pong" };

const factories = createRouteFactories<string>({
  user: {
    resolveUser: async () => {
      resolveCount += 1;
      return currentUser as never;
    },
    resolveTokenSession: async () => currentUser as never,
    evaluateAccess: evaluateApiAccessRule,
    availableStatuses: ["active"],
  },
  device: {
    authenticateRequestDevice: async () => null,
    syncPairedDeviceCookie: (response) => response,
    checkPairedDeviceRateLimit: async () => null,
    pairedDeviceErrorResponse: () => null,
  },
  domains: {
    adminOnly: {
      service: async () => ownerService as never,
      access: { read: { roleCategories: ["admin"] }, write: { roleCategories: ["admin"] } },
      table: "admin_only",
      idColumn: "id",
    } as never,
  },
});
const { createApiRoute, createDomainRoute, createMeRoute, enforceAccessRule } = factories;

const active: FakeUser = { userId: "u1", role: "user", status: "active", isDemo: false };
const suspended: FakeUser = { userId: "u2", role: "user", status: "suspended", isDemo: false };
const inactive: FakeUser = { userId: "u3", role: "user", status: "inactive", isDemo: false };

type Route<P> = (req: NextRequest, ctx: { params: Promise<P> }) => Promise<Response>;
const call = <P extends object>(route: Route<P>, params = {} as P) =>
  route(new NextRequest("http://localhost/api/test", { method: "GET" }), { params: Promise.resolve(params) });

const echoUser = (access: Parameters<typeof createApiRoute>[0]["access"], allowStatuses?: readonly string[]) =>
  createApiRoute(
    { operation: "GET /api/test", operationType: "read", access, allowStatuses: allowStatuses as never },
    async (_req, { user }) => ({ userId: user?.userId ?? null }),
  );

test("public: 未ログインと利用できない status は ctx.user が null、利用可能なら利用者", async () => {
  currentUser = null;
  assert.deepEqual(await (await call(echoUser("public"))).json(), { userId: null });
  currentUser = suspended;
  assert.deepEqual(await (await call(echoUser("public"))).json(), { userId: null });
  currentUser = active;
  assert.deepEqual(await (await call(echoUser("public"))).json(), { userId: "u1" });
});

test("public + allowStatuses: 列挙した status なら利用者を渡す", async () => {
  currentUser = suspended;
  assert.deepEqual(await (await call(echoUser("public", ["active", "suspended"]))).json(), { userId: "u2" });
});

test("authenticated / roles: ctx.user は必ずいる。未ログイン 401・権限なし 403（code 付き）", async () => {
  currentUser = active;
  assert.deepEqual(await (await call(echoUser("authenticated"))).json(), { userId: "u1" });

  currentUser = null;
  const unauth = await call(echoUser("authenticated"));
  assert.equal(unauth.status, 401);
  assert.equal((await unauth.json()).code, "unauthenticated");

  currentUser = active;
  const forbidden = await call(echoUser({ roleCategories: ["admin"] }));
  assert.equal(forbidden.status, 403);
  assert.equal((await forbidden.json()).code, "forbidden");

  currentUser = suspended;
  assert.equal((await call(echoUser("authenticated"))).status, 403, "利用停止は認証済みでも 403");
});

test("allowStatuses: 列挙した status だけを通す（fail-closed）", async () => {
  currentUser = inactive;
  assert.deepEqual(await (await call(echoUser("authenticated", ["inactive"]))).json(), { userId: "u3" });
  currentUser = suspended;
  assert.equal((await call(echoUser("authenticated", ["inactive"]))).status, 403);
  currentUser = active;
  assert.equal((await call(echoUser("authenticated", ["inactive"]))).status, 403, "active も列挙しなければ通さない");
});

test("createMeRoute: 認証済みの利用者を渡し、allowStatuses を受ける", async () => {
  const route = createMeRoute(
    { operation: "GET /api/me/test", operationType: "read", allowStatuses: ["inactive"] },
    async (_req, { user }) => ({ userId: user.userId }),
  );
  currentUser = inactive;
  assert.deepEqual(await (await call(route)).json(), { userId: "u3" });
  currentUser = null;
  assert.equal((await call(route)).status, 401);
});

test("形の外の access（JS・as any）は利用者を解かずに 500 route_access_invalid（fail-closed）", async () => {
  const originalError = console.error;
  const logged: string[] = [];
  console.error = (message: string) => logged.push(message);
  try {
    for (const access of [undefined, null, "custom", [], 1]) {
      let reached = false;
      const route = createApiRoute(
        { operation: "GET /api/invalid", operationType: "read", access: access as never },
        async () => {
          reached = true;
          return { ok: true };
        },
      );
      for (const user of [null, active]) {
        currentUser = user;
        resolveCount = 0;
        const res = await call(route);
        assert.equal(res.status, 500, `${String(access)} / ${user ? "ログイン済み" : "未ログイン"}`);
        assert.equal((await res.json()).code, "route_access_invalid");
        assert.equal(resolveCount, 0, "利用者を解かない");
      }
      assert.equal(reached, false, "handler に届かない");
    }
    assert.equal(logged.length, 5, "組み立て時に 1 本 1 回だけ記録する");
    assert.match(logged[2], /"custom"/);
  } finally {
    console.error = originalError;
  }
});

test("主体はリクエストごとに 1 回だけ解く", async () => {
  currentUser = active;
  resolveCount = 0;
  await call(echoUser("authenticated"));
  assert.equal(resolveCount, 1);
});

test("ハンドラが返した素の Response（NextResponse 以外）はそのまま返す", async () => {
  currentUser = null;
  const route = createApiRoute({ operation: "GET /api/test", operationType: "read", access: "public" }, async () =>
    new Response("moved", { status: 303, headers: { location: "http://localhost/done" } }),
  );
  const res = await call(route);
  assert.equal(res.status, 303);
  assert.equal(res.headers.get("location"), "http://localhost/done");
  assert.equal(await res.text(), "moved");
});

test("DomainError の code / details は body に載る（指定が無ければ載らない）", async () => {
  currentUser = null;
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const withCode = createApiRoute({ operation: "GET /api/test", operationType: "read", access: "public" }, async () => {
      throw new DomainError("期限切れです", { status: 409, code: "coupon_expired", details: { expiredAt: "2026-01-01" } });
    });
    const res = await call(withCode);
    assert.equal(res.status, 409);
    assert.deepEqual(await res.json(), {
      message: "期限切れです",
      code: "coupon_expired",
      details: { expiredAt: "2026-01-01" },
    });

    const plain = createApiRoute({ operation: "GET /api/test", operationType: "read", access: "public" }, async () => {
      throw new DomainError("だめ", { status: 400 });
    });
    assert.deepEqual(await (await call(plain)).json(), { message: "だめ" });
  } finally {
    console.error = originalConsoleError;
  }
});

test("createDomainRoute の拒否は {domain, operation} を body に載せる。未登録のドメインは text/plain の 404", async () => {
  const route = createDomainRoute(
    { operation: "GET /api/[domain]", operationType: "read", crudOp: "list" },
    async (_req, { service }) => (service as typeof ownerService).ping(),
  );
  currentUser = active;
  const res = await call(route, { domain: "adminOnly" });
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), {
    message: "この操作を行う権限がありません。",
    code: "forbidden",
    domain: "adminOnly",
    operation: "list",
  });
  const missing = await call(route, { domain: "unknown" });
  assert.equal(missing.status, 404);
  assert.equal(await missing.text(), "Not Found", "404 は text/plain のまま");
});

test("enforceAccessRule(rule, user) は渡された利用者で評価し、主体を引き直さない", async () => {
  currentUser = active;
  resolveCount = 0;
  assert.equal((await enforceAccessRule({ roleCategories: ["admin"] }, null))?.status, 401);
  const denied = await enforceAccessRule({ roleCategories: ["admin"] }, active as never, { domain: "x", operation: "export" });
  assert.equal(denied?.status, 403);
  assert.deepEqual(await denied?.json(), {
    message: "この操作を行う権限がありません。",
    code: "forbidden",
    domain: "x",
    operation: "export",
  });
  assert.equal(await enforceAccessRule("authenticated", active as never), null);
  assert.equal(resolveCount, 0);
});
