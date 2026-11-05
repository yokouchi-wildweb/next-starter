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
let userOutage = false;

const ownerService = { ping: async () => "pong" };

let rateLimitAllowed = true;
const rateLimitCalls: [string, string][] = [];

const factories = createRouteFactories<Record<string, unknown>, any, any, any>({
  rateLimit: {
    checkRateLimit: async (category, identifier) => {
      rateLimitCalls.push([category, identifier]);
      return { allowed: rateLimitAllowed, resetAt: new Date(Date.now() + 30_000) };
    },
  },
  user: {
    resolveUser: async () => {
      resolveCount += 1;
      if (userOutage) throw new Error("connect ECONNREFUSED (users)");
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

test("レート制限: 注入した判定を IP とサブネットで呼び、超えたら 429 と Retry-After", async () => {
  const route = createApiRoute(
    { operation: "GET /test", operationType: "read", access: "public", rateLimit: "signup", rateLimitSubnet: "signup" },
    async () => ({ ok: true }),
  );
  const call = () =>
    route(new NextRequest("http://localhost/api/test", { headers: { "x-forwarded-for": "1.2.3.4" } }), {
      params: Promise.resolve({}),
    });

  rateLimitCalls.length = 0;
  rateLimitAllowed = true;
  assert.equal((await call()).status, 200);
  assert.deepEqual(rateLimitCalls, [["signup", "1.2.3.4"], ["signup", "1.2.3"]]);

  rateLimitAllowed = false;
  const limited = await call();
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("Retry-After")) >= 1);
  rateLimitAllowed = true;
});

test("門番の口(gate): 閉じた住所は主体の解決・認可・ハンドラの前に not_found の 404。開いた住所と口の省略は今と同じ", async () => {
  let resolved = 0;
  let tokenResolved = 0;
  let handled = 0;
  let deviceAuth = 0;
  const gated = createRouteFactories<Record<string, unknown>, any, any, any>({
    rateLimit: { checkRateLimit: async () => ({ allowed: true, resetAt: new Date() }) },
    user: {
      resolveUser: async () => {
        resolved += 1;
        return active as never;
      },
      resolveTokenSession: async () => {
        tokenResolved += 1;
        return active as never;
      },
      evaluateAccess: evaluateApiAccessRule,
      availableStatuses: ["active"],
    },
    device: {
      authenticateRequestDevice: async () => {
        deviceAuth += 1;
        return null;
      },
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
    gate: { isClosed: (pathname) => pathname === "/api/closed" || pathname.startsWith("/api/closed/") },
  });
  const at = (path: string) => new NextRequest(`http://localhost${path}`, { method: "GET" });
  const handler = async () => {
    handled += 1;
    return { ok: true };
  };
  const routes = {
    api: gated.createApiRoute({ operation: "GET /api/x", operationType: "read", access: "public" }, handler),
    me: gated.createMeRoute({ operation: "GET /api/me/x", operationType: "read" }, handler),
    domain: gated.createDomainRoute({ operation: "GET /api/[domain]", operationType: "read", crudOp: "list" }, handler),
    device: gated.createDeviceRoute({ operation: "GET /api/device/x", operationType: "read" } as never, handler as never),
  };
  for (const [name, route] of Object.entries(routes)) {
    resolved = tokenResolved = handled = deviceAuth = 0;
    const res = await (route as Route<object>)(at("/api/closed/x"), { params: Promise.resolve({ domain: "adminOnly" }) });
    assert.equal(res.status, 404, name);
    assert.equal(await res.text(), "Not Found", `${name}: 機能名を出さない`);
    assert.deepEqual([resolved, tokenResolved, handled, deviceAuth], [0, 0, 0, 0], `${name}: 何も解かない`);
  }
  // 開いた住所は今と同じ(public の api はハンドラまで届く)
  handled = 0;
  const open = await routes.api(at("/api/open"), { params: Promise.resolve({}) });
  assert.equal(open.status, 200);
  assert.equal(handled, 1);
  // 口を省略した Factory(上の factories)は住所で閉じない
  currentUser = active;
  const plain = await createApiRoute({ operation: "GET /api/closed", operationType: "read", access: "public" }, async () => ({ ok: true }))(
    at("/api/closed"),
    { params: Promise.resolve({}) },
  );
  assert.equal(plain.status, 200);
});

test("利用者の DB 引きの障害（束の throw）は全 Factory で 503 route_user_unavailable。401 / 403 にも JWT のクレームにも落とさない", async () => {
  const originalError = console.error;
  console.error = () => {};
  userOutage = true;
  // JWT のクレームだけなら admin で通る状態（resolveTokenSession は currentUser を返す）。それでも通さない
  currentUser = { userId: "a1", role: "admin", status: "active", isDemo: false };
  let handled = 0;
  const handler = async () => {
    handled += 1;
    return { ok: true };
  };
  try {
    const routes = {
      public: createApiRoute({ operation: "GET /api/x", operationType: "read", access: "public" }, handler),
      authenticated: createApiRoute({ operation: "GET /api/x", operationType: "read", access: "authenticated" }, handler),
      role: createApiRoute({ operation: "GET /api/x", operationType: "read", access: { roleCategories: ["admin"] } }, handler),
      me: createMeRoute({ operation: "GET /api/me/x", operationType: "read" }, handler),
      domain: createDomainRoute({ operation: "GET /api/[domain]", operationType: "read", crudOp: "list" }, handler),
    };
    for (const [name, route] of Object.entries(routes)) {
      const res = await call(route as Route<object>, { domain: "adminOnly" });
      assert.equal(res.status, 503, name);
      const body = await res.json();
      assert.equal(body.code, "route_user_unavailable", name);
      assert.doesNotMatch(JSON.stringify(body), /ECONNREFUSED/, `${name}: 障害の内部情報を返さない`);
    }
    assert.equal(handled, 0, "ハンドラに届かない");
  } finally {
    userOutage = false;
    console.error = originalError;
  }
});

test("user: \"skip\"（public だけ）: 利用者を解かず ctx.user は null。省略は今と同じ", async () => {
  currentUser = active;
  resolveCount = 0;
  const skipped = createApiRoute(
    { operation: "GET /api/public", operationType: "read", access: "public", user: "skip" },
    async (_req, { user }) => ({ userId: user?.userId ?? null }),
  );
  assert.deepEqual(await (await call(skipped)).json(), { userId: null });
  assert.equal(resolveCount, 0, "users を読まない");
  // DB 障害でも skip のルートは利用者を引かないので影響を受けない
  userOutage = true;
  try {
    assert.equal((await call(skipped)).status, 200);
  } finally {
    userOutage = false;
  }
  resolveCount = 0;
  assert.deepEqual(await (await call(echoUser("public"))).json(), { userId: "u1" });
  assert.equal(resolveCount, 1, "省略は今まで通り 1 回解く");
});

test("user: \"skip\" を public 以外・未知の値で渡すと利用者を解かずに 500 route_access_invalid（無視しない）", async () => {
  const originalError = console.error;
  const logged: string[] = [];
  console.error = (message: string) => logged.push(message);
  try {
    const cases: [unknown, unknown][] = [
      ["authenticated", "skip"],
      [{ roleCategories: ["admin"] }, "skip"],
      ["public", "lazy"],
    ];
    for (const [access, user] of cases) {
      let reached = false;
      const route = createApiRoute(
        { operation: "GET /api/bad-skip", operationType: "read", access: access as never, user: user as never },
        async () => {
          reached = true;
          return { ok: true };
        },
      );
      currentUser = active;
      resolveCount = 0;
      const res = await call(route);
      assert.equal(res.status, 500, JSON.stringify([access, user]));
      assert.equal((await res.json()).code, "route_access_invalid");
      assert.equal(resolveCount, 0, "利用者を解かない");
      assert.equal(reached, false, "handler に届かない");
    }
    assert.equal(logged.length, 3, "組み立て時に 1 本 1 回だけ記録する");
  } finally {
    console.error = originalError;
  }
});
