// src/app/api/admin/messaging/send/route.test.mts
// /api/admin/messaging/send 以下の 5 ファイルの検査(Factory・門・messaging の service は偽物。入口の守りは本物)。
// - 宣言: 全部の口が access { roleCategories: ["admin"] }
// - 門 messagingBroadcast が閉なら 404 で service を呼ばない
// - 取引の連絡を全員・ロール・audiences へ送る要求は API で 400(service を呼ばない、AMENDMENT 1)
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
  const body = { message: { type: "adhoc" }, audience: { type: "all" } };
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

test("取引を全員・ロール・audiences へ: API で 400、選んだ利用者は通す", async () => {
  for (const audience of [{ type: "all" }, { type: "role", roles: ["user"] }, { type: "audience", key: "x" }, undefined]) {
    const res = await send.POST(post("", { kind: "transactional", audience }));
    assert.equal(res.status, 400);
  }
  assert.equal(calls.length, 0);
  const ok = await send.POST(post("", { kind: "transactional", audience: { type: "users", userIds: ["u1"] } }));
  assert.equal(ok.status, 200);
  assert.equal(calls.length, 1);
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
