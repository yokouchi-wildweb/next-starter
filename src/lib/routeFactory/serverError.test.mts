// src/lib/routeFactory/serverError.test.mts
// 想定外の失敗(500)だけが記録の口へ渡り、応答は変わらないこと(D40)。実行: pnpm test src/lib/routeFactory/serverError.test.mts
import assert from "node:assert/strict";
import { mock, test } from "node:test";

import nextServer, { NextRequest } from "next/server";

// 入口の芯は最初に next/server の connection() を待つ。Next のリクエストの外(ここ)では throw するので空にする
mock.module("next/server", { namedExports: { ...nextServer, connection: async () => {} } });

const { createRouteFactories } = await import("./createRouteFactories.ts");
const { DomainError } = await import("@/lib/errors");

type Reported = { error: unknown; input: { path: string; method: string; headers: Record<string, string>; requestId: string; operation: string } };

function factories(reported: Reported[] | null) {
  return createRouteFactories<Record<string, unknown>, any, any, any>({
    rateLimit: { checkRateLimit: async () => ({ allowed: true, resetAt: new Date() }) },
    user: {
      resolveUser: async () => null as never,
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
    ...(reported ? { serverError: { onServerError: async (error, input) => void reported.push({ error, input }) } } : {}),
  });
}

const call = (route: (req: NextRequest, ctx: { params: Promise<object> }) => Promise<Response>) =>
  route(
    new NextRequest("http://localhost/api/x?token=secret", { method: "POST", headers: { "x-request-id": "req-1", cookie: "a=b" } }),
    { params: Promise.resolve({}) },
  );

test("DomainError 以外は口へ渡り(path・method・requestId・operation、headers は口へだけ)、応答は 500 の汎用文言", async () => {
  const reported: Reported[] = [];
  const route = factories(reported).createApiRoute({ operation: "POST /api/x", operationType: "read", access: "public" }, async () => {
    throw new Error("db down");
  });
  const res = await call(route);
  assert.equal(res.status, 500);
  assert.ok(!(await res.text()).includes("db down"));
  assert.equal(reported.length, 1);
  assert.equal((reported[0].error as Error).message, "db down");
  assert.deepEqual(
    { ...reported[0].input, headers: reported[0].input.headers.cookie },
    { path: "/api/x", method: "POST", headers: "a=b", requestId: "req-1", operation: "POST /api/x" },
  );
});

test("400 番台の DomainError は口へ渡さず、500 以上の DomainError は渡す", async () => {
  const reported: Reported[] = [];
  const f = factories(reported);
  const r400 = f.createApiRoute({ operation: "a", operationType: "read", access: "public" }, async () => {
    throw new DomainError("bad input", { status: 422 });
  });
  const r503 = f.createApiRoute({ operation: "b", operationType: "read", access: "public" }, async () => {
    throw new DomainError("upstream down", { status: 503 });
  });
  assert.equal((await call(r400)).status, 422);
  assert.equal(reported.length, 0);
  assert.equal((await call(r503)).status, 503);
  assert.equal(reported.length, 1);
});

test("口の無い束は今の通り(500 を返す)", async () => {
  const route = factories(null).createApiRoute({ operation: "c", operationType: "read", access: "public" }, async () => {
    throw new Error("boom");
  });
  const original = console.error;
  const lines: unknown[][] = [];
  console.error = (...args: unknown[]) => void lines.push(args);
  try {
    assert.equal((await call(route)).status, 500);
  } finally {
    console.error = original;
  }
  assert.equal(lines[0]?.[0], "c failed:");
});
