// src/app/api/admin/messaging/bulk-send/route.test.mts
// /api/admin/messaging/bulk-send 以下の 3 ファイル(GET 選択肢・POST 送る・POST preview・POST test)の検査
// (Factory・門・messaging の service は偽物)。
// - 宣言: 全部の口が access { roleCategories: ["admin"] }
// - 門 messagingBroadcast を見ない(閉じていても一括送信・プレビュー・テストは使える、指令 40 の AMENDMENT 1・2)。
//   テンプレートの選択肢を門 messagingTemplates で絞るのは service(admin.test.ts)
// - body をそのまま service へ渡す。壊れた JSON は送る口では 400、プレビュー・テストでは null を渡す(service が 400)
// 実行: pnpm test src/app/api/admin/messaging/bulk-send/route.test.mts

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
      const out = await handler(req);
      return out instanceof Response ? out : NextResponse.json(out);
    } catch (error) {
      if (error instanceof DomainError) return NextResponse.json({ message: error.message }, { status: error.status });
      throw error;
    }
  };
};
mock.module("@/wiring/apiRoute", { namedExports: { createApiRoute } });

// 門は閉じている前提: どの口も門を見てはいけない
const asserted: string[] = [];
mock.module("@/featureGate", {
  namedExports: {
    gate: {
      assert: (name: string) => {
        asserted.push(name);
        throw new DomainError("not found", { status: 404 });
      },
      enabled: () => false,
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
      ["adminBulkSend", "adminBulkSendPreview", "adminBulkSendTest", "adminBulkSendOptions"].map((name) => [name, record(name)]),
    ),
  },
});

const bulk = await import("./route.ts");
const preview = await import("./preview/route.ts");
const testSend = await import("./test/route.ts");

const BASE = "http://localhost/api/admin/messaging/bulk-send";
const post = (path: string, body: unknown) =>
  new NextRequest(`${BASE}${path}`, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });
const ctx = { params: Promise.resolve({}) };

beforeEach(() => {
  calls.length = 0;
  asserted.length = 0;
});

test("宣言: 4 つの口は全部 admin", () => {
  assert.deepEqual(
    declared.map((d) => d.operation).sort(),
    [
      "GET /api/admin/messaging/bulk-send",
      "POST /api/admin/messaging/bulk-send",
      "POST /api/admin/messaging/bulk-send/preview",
      "POST /api/admin/messaging/bulk-send/test",
    ],
  );
  assert.ok(declared.every((d) => JSON.stringify(d.access) === JSON.stringify({ roleCategories: ["admin"] })));
});

test("門 messagingBroadcast を見ずに body をそのまま service へ渡す", async () => {
  const body = { userIds: ["u1"], category: "marketing", content: { email: { subject: "s", paragraphs: ["b"] } } };
  const content = { category: "marketing", content: body.content };
  for (const res of [
    await bulk.POST(post("", body), ctx),
    await preview.POST(post("/preview", content), ctx),
    await testSend.POST(post("/test", content), ctx),
    await bulk.GET(new NextRequest(BASE), ctx),
  ]) {
    assert.equal(res.status, 200);
  }
  assert.deepEqual(calls, [
    ["adminBulkSend", body],
    ["adminBulkSendPreview", content],
    ["adminBulkSendTest", content],
    ["adminBulkSendOptions"],
  ]);
  assert.deepEqual(asserted, []);
});

test("壊れた JSON: 送る口は 400(service を呼ばない)、プレビュー・テストは null を渡す", async () => {
  const res = await bulk.POST(post("", "{"), ctx);
  assert.equal(res.status, 400);
  await preview.POST(post("/preview", "{"), ctx);
  await testSend.POST(post("/test", "{"), ctx);
  assert.deepEqual(calls, [
    ["adminBulkSendPreview", null],
    ["adminBulkSendTest", null],
  ]);
});
