// src/app/api/me/messaging/preferences/route.test.mts
// /api/me/messaging/preferences の検査(Factory・門・messaging の service は偽物)。
// - 本人(ctx.user.userId)の行だけを読み書きする(body の userId は使わない)
// - 門 messagingPreferences が閉なら 404、本人が無ければ 401(Factory の偽物で createMeRoute の契約を写す)
// 実行: pnpm test src/app/api/me/messaging/preferences/route.test.mts

import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

import { NextRequest, NextResponse } from "next/server";

const { DomainError } = await import("@/lib/errors");

// createMeRoute の偽物: 主体はヘッダ x-test-user から(無ければ 401)、DomainError は status の JSON
type Handler = (req: NextRequest, ctx: { user: { userId: string } }) => Promise<Response>;
const createMeRoute = (_options: unknown, handler: Handler) => async (req: NextRequest) => {
  const userId = req.headers.get("x-test-user");
  if (!userId) return NextResponse.json({ message: "unauthorized" }, { status: 401 });
  try {
    return await handler(req, { user: { userId } });
  } catch (error) {
    if (error instanceof DomainError) return NextResponse.json({ message: error.message }, { status: error.status });
    throw error;
  }
};
mock.module("@/wiring/apiRoute", { namedExports: { createMeRoute } });

let gateOpen = true;
const asserted: string[] = [];
mock.module("@/featureGate", {
  namedExports: {
    gate: {
      assert: (name: string) => {
        asserted.push(name);
        if (!gateOpen) throw new DomainError("not found", { status: 404 });
      },
    },
  },
});

const calls: { fn: string; userId: string; input?: unknown }[] = [];
const grid = { allOptedOut: false, channels: [], categories: [] };
mock.module("@/features/core/messaging/services/server", {
  namedExports: {
    messagingService: {
      getMessagePreferences: async (userId: string) => {
        calls.push({ fn: "get", userId });
        return grid;
      },
      setMessagePreference: async (userId: string, input: unknown) => {
        calls.push({ fn: "set", userId, input });
        return { ...grid, allOptedOut: true };
      },
    },
  },
});

const { GET, PATCH } = await import("./route.ts");

const URL_ = "http://localhost/api/me/messaging/preferences";
const ctx = { params: Promise.resolve({}) };

beforeEach(() => {
  gateOpen = true;
  calls.length = 0;
  asserted.length = 0;
});

test("GET: 本人の表を返す", async () => {
  const res = await GET(new NextRequest(URL_, { headers: { "x-test-user": "u1" } }), ctx);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { preferences: grid });
  assert.deepEqual(calls, [{ fn: "get", userId: "u1" }]);
  assert.deepEqual(asserted, ["messagingPreferences"]);
});

test("PATCH: body を本人の変更として渡し、変えた後の表を返す(body の userId は使わない)", async () => {
  const body = { category: "marketing", channel: "email", optedOut: true, userId: "other" };
  const res = await PATCH(
    new NextRequest(URL_, { method: "PATCH", headers: { "x-test-user": "u1" }, body: JSON.stringify(body) }),
    ctx,
  );
  assert.equal(res.status, 200);
  assert.equal((await res.json()).preferences.allOptedOut, true);
  assert.deepEqual(calls, [{ fn: "set", userId: "u1", input: body }]);
});

test("PATCH: 壊れた JSON は null を渡す(service が 400 にする)", async () => {
  await PATCH(new NextRequest(URL_, { method: "PATCH", headers: { "x-test-user": "u1" }, body: "{" }), ctx);
  assert.deepEqual(calls, [{ fn: "set", userId: "u1", input: null }]);
});

test("門が閉なら 404 で service を呼ばない", async () => {
  gateOpen = false;
  const res = await GET(new NextRequest(URL_, { headers: { "x-test-user": "u1" } }), ctx);
  assert.equal(res.status, 404);
  const patched = await PATCH(new NextRequest(URL_, { method: "PATCH", headers: { "x-test-user": "u1" }, body: "{}" }), ctx);
  assert.equal(patched.status, 404);
  assert.equal(calls.length, 0);
});

test("本人が無ければ 401", async () => {
  const res = await GET(new NextRequest(URL_), ctx);
  assert.equal(res.status, 401);
  assert.equal(calls.length, 0);
});
