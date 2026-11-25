// src/lib/routeFactory/onRejected.test.mts
// Factory 自身が断った時(回数制限 429・reCAPTCHA 403 / 428)に、route の onRejected が監査の文脈の中で 1 回呼ばれ、
// 答えは変わらず、口の誤りは飲み込まれること。実行: pnpm test src/lib/routeFactory/onRejected.test.mts
import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

import nextServer, { NextRequest } from "next/server";

// 入口の芯は最初に next/server の connection() を待つ。Next のリクエストの外(ここ)では throw するので空にする
mock.module("next/server", { namedExports: { ...nextServer, connection: async () => {} } });

let v3 = { valid: true, score: 0.9, error: undefined as string | undefined, requireV2Challenge: false };
mock.module("@/lib/recaptcha/server", {
  namedExports: {
    RECAPTCHA_DEBUG: { enabled: false, forceScore: null },
    RECAPTCHA_V2_INTERNALS: { enabled: true, siteKey: "v2-site" },
    RECAPTCHA_V3_INTERNALS: { enabled: true },
    verifyRecaptcha: async () => v3,
    verifyRecaptchaV2: async () => ({ valid: false, error: "bad-v2" }),
  },
});

const { createRouteFactories } = await import("./createRouteFactories.ts");
const { getAuditContext } = await import("@/lib/audit/server");

let denied = new Set<string>();
function factories() {
  return createRouteFactories<Record<string, unknown>, any, any, any>({
    rateLimit: { checkRateLimit: async (category: string) => ({ allowed: !denied.has(category), resetAt: new Date(Date.now() + 60_000) }) },
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
  });
}

type Seen = { rejection: Record<string, unknown>; requestId: string | undefined };
const call = (route: (req: NextRequest, ctx: { params: Promise<object> }) => Promise<Response>, headers: Record<string, string> = {}) =>
  route(
    new NextRequest("http://localhost/api/x", { method: "POST", headers: { "x-request-id": "req-1", "x-forwarded-for": "10.1.2.3", ...headers } }),
    { params: Promise.resolve({}) },
  );

function route(seen: Seen[], onRejectedThrows = false) {
  return factories().createApiRoute(
    {
      operation: "POST /api/x",
      operationType: "read",
      access: "public",
      rateLimit: "ipCat",
      rateLimitSubnet: "subnetCat",
      recaptcha: { action: "register" as never },
      onRejected: async (rejection: Record<string, unknown>) => {
        seen.push({ rejection, requestId: getAuditContext()?.requestId });
        if (onRejectedThrows) throw new Error("audit down");
      },
    } as never,
    async () => ({ ok: true }),
  );
}

beforeEach(() => {
  denied = new Set();
  v3 = { valid: true, score: 0.9, error: undefined, requireV2Challenge: false };
});

test("回数制限(IP・サブネット)で断ると 429 のまま、onRejected が監査の文脈の中で 1 回呼ばれる", async () => {
  const seen: Seen[] = [];
  denied.add("ipCat");
  const ip = await call(route(seen));
  assert.equal(ip.status, 429);
  denied = new Set(["subnetCat"]);
  const subnet = await call(route(seen));
  assert.equal(subnet.status, 429);
  assert.equal((await subnet.json()).silent, true);
  assert.deepEqual(seen, [
    { rejection: { kind: "rateLimit", scope: "ip", category: "ipCat", identifier: "10.1.2.3" }, requestId: "req-1" },
    { rejection: { kind: "rateLimit", scope: "subnet", category: "subnetCat", identifier: "10.1.2" }, requestId: "req-1" },
  ]);
});

test("reCAPTCHA: v3 の失敗 403・中間の点数の 428・v2 の失敗 403 で呼ばれる(版・誤り・点数)", async () => {
  const seen: Seen[] = [];
  v3 = { valid: false, score: 0.1, error: "low-score", requireV2Challenge: false };
  assert.equal((await call(route(seen))).status, 403);
  v3 = { valid: false, score: 0.5, error: "mid-score", requireV2Challenge: true };
  assert.equal((await call(route(seen))).status, 428);
  assert.equal((await call(route(seen), { "X-Recaptcha-V2-Token": "t" })).status, 403);
  assert.deepEqual(
    seen.map((s) => s.rejection),
    [
      { kind: "recaptcha", version: "v3", outcome: "failed", error: "low-score", score: 0.1 },
      { kind: "recaptcha", version: "v3", outcome: "challenge", error: "mid-score", score: 0.5 },
      { kind: "recaptcha", version: "v2", outcome: "failed", error: "bad-v2" },
    ],
  );
});

test("口が投げても答えは同じ(429)、通った要求では呼ばれない", async () => {
  const seen: Seen[] = [];
  denied.add("ipCat");
  const original = console.error;
  console.error = () => {};
  try {
    assert.equal((await call(route(seen, true))).status, 429);
  } finally {
    console.error = original;
  }
  denied = new Set();
  const ok = await call(route(seen));
  assert.equal(ok.status, 200);
  assert.equal(seen.length, 1);
});
