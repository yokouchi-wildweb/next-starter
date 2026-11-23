// 入口(createApiRoute・createDeviceRoute は同じ範囲)が handler を cacheTags の範囲で包み、
// handler の中で積んだ札を終わりに 1 回 revalidateTag(tag, { expire: 0 })へ渡すこと(cron の入口は src/lib/cron/cacheTags.test.mts)。
// 実行: pnpm test src/lib/routeFactory/cacheTags.test.mts
import assert from "node:assert/strict";
import { mock, test } from "node:test";

import nextServer, { NextRequest } from "next/server";


const revalidated: Array<{ tag: string; profile: unknown }> = [];
mock.module("next/server", { namedExports: { ...nextServer, connection: async () => {} } });
mock.module("next/cache", { namedExports: { revalidateTag: (tag: string, profile: unknown) => void revalidated.push({ tag, profile }) } });

const { createRouteFactories } = await import("./createRouteFactories.ts");
const { markCacheTags } = await import("@/lib/cacheTags/server");

const factories = () =>
  createRouteFactories<Record<string, unknown>, any, any, any>({
    rateLimit: { checkRateLimit: async () => ({ allowed: true, resetAt: new Date() }) },
    user: { resolveUser: async () => null as never, resolveTokenSession: async () => null, evaluateAccess: () => "granted", availableStatuses: ["active"] },
    device: { authenticateRequestDevice: async () => null, syncPairedDeviceCookie: (response) => response, checkPairedDeviceRateLimit: async () => null, pairedDeviceErrorResponse: () => null },
    domains: {},
  });

test("createApiRoute: handler の中の印を handler の後に expire 0 で消す(throw でも)", async () => {
  revalidated.length = 0;
  const ok = factories().createApiRoute({ operation: "POST /api/x", operationType: "write", access: "public" }, async () => {
    markCacheTags("post", "post:1");
    assert.equal(revalidated.length, 0, "handler の途中では消さない");
    return { ok: true };
  });
  const res = await ok(new NextRequest("http://localhost/api/x", { method: "POST" }), { params: Promise.resolve({}) });
  assert.equal(res.status, 200);
  assert.deepEqual(revalidated, [{ tag: "post", profile: { expire: 0 } }, { tag: "post:1", profile: { expire: 0 } }]);

  revalidated.length = 0;
  const failing = factories().createApiRoute({ operation: "POST /api/y", operationType: "write", access: "public" }, async () => {
    markCacheTags("post:2");
    throw new Error("after write");
  });
  const failed = await failing(new NextRequest("http://localhost/api/y", { method: "POST" }), { params: Promise.resolve({}) });
  assert.equal(failed.status, 500);
  assert.deepEqual(revalidated.map((r) => r.tag), ["post:2"]);
});
