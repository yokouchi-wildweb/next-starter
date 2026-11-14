// src/app/api/admin/messaging/send/route.test.mts
// /api/admin/messaging/send 以下の 5 ファイルの検査(Factory・門・messaging の service は偽物。入口の守りは本物)。
// - 宣言: 全部の口が access { roleCategories: ["admin"] }
// - 門 messagingBroadcast が閉なら 404 で service を呼ばない
// - カテゴリーと宛先の組の検査は service だけ(API は body をそのまま渡す。前の kind の入口の守りは無い)
// - body をそのまま service へ渡す
// 実行: pnpm test src/app/api/admin/messaging/send/route.test.mts

import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

import { NextRequest, NextResponse } from "next/server";

const { DomainError } = await import("@/lib/errors");

const declared: { operation: string; access: unknown }[] = [];
type Handler = (req: NextRequest) => Promise<unknown>;
const createApiRoute = (options: { operation: string; access: unknown }, handler: Handler) => {
  declared.push({ operation: options.operation, access: options.access });
  return async (req: NextRequest) => {
    try {
      return NextResponse.json(await handler(req));
    } catch (error) {
      if (error instanceof DomainError) return NextResponse.json({ message: error.message }, { status: error.status });
      throw error;
    }
  };
};
mock.module("@/wiring/apiRoute", { namedExports: { createApiRoute } });

let gateOpen = true;
mock.module("@/featureGate", {
  namedExports: {
    gate: {
      assert: (name: string) => {
        assert.equal(name, "messagingBroadcast");
        if (!gateOpen) throw new DomainError("not found", { status: 404 });
      },
    },
  },
});

const calls: unknown[][] = [];
const record = (name: string) => async (...args: unknown[]) => {
  calls.push([name, ...args]);
  return { ok: name };
};
mock.module("@/features/core/messaging/services/server/messagingService", {
  namedExports: {
    messagingService: Object.fromEntries(
      ["adminSend", "adminSendPreview", "adminSendEstimate", "adminSendTest", "adminSendOptions"].map((name) => [name, record(name)]),
    ),
  },
});

const send = await import("./route.ts");
const preview = await import("./preview/route.ts");
const estimate = await import("./estimate/route.ts");
const testSend = await import("./test/route.ts");
const options = await import("./options/route.ts");

const BASE = "http://localhost/api/admin/messaging/send";
const post = (path: string, body: unknown) => new NextRequest(`${BASE}${path}`, { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  gateOpen = true;
  calls.length = 0;
});

test("宣言: 5 つの口が全部管理者だけ", () => {
  assert.equal(declared.length, 5);
  for (const entry of declared) assert.deepEqual(entry.access, { roleCategories: ["admin"] }, entry.operation);
});

test("body をそのまま渡す", async () => {
  const body = { content: { inApp: { title: "t", body: "b" } }, category: "announcement", audience: { type: "all" } };
  await send.POST(post("", body));
  await preview.POST(post("/preview", body));
  await estimate.POST(post("/estimate", { audience: { type: "all" } }));
  await testSend.POST(post("/test", body));
  await options.GET(new NextRequest(`${BASE}/options`));
  assert.deepEqual(calls, [
    ["adminSend", body],
    ["adminSendPreview", body],
    ["adminSendEstimate", { audience: { type: "all" } }],
    ["adminSendTest", body],
    ["adminSendOptions"],
  ]);
});

test("カテゴリーの body は入口で止めずに service へ渡す(検査は service)", async () => {
  const body = { category: "operatorDirect", audience: { type: "all" } };
  const res = await send.POST(post("", body));
  assert.equal(res.status, 200);
  assert.deepEqual(calls, [["adminSend", body]]);
});

test("門が閉なら 404 で service を呼ばない", async () => {
  gateOpen = false;
  for (const res of [
    await send.POST(post("", {})),
    await preview.POST(post("/preview", {})),
    await estimate.POST(post("/estimate", {})),
    await testSend.POST(post("/test", {})),
    await options.GET(new NextRequest(`${BASE}/options`)),
  ]) {
    assert.equal(res.status, 404);
  }
  assert.equal(calls.length, 0);
});
