// src/app/api/admin/messaging/dispatches/operations.test.mts
// 送信の操作の口の検査(Factory・messaging の service は偽物): DELETE [id](削除、D88)・bulk-delete・delete-summary・[id]/resend。
// 取り消し・取り下げの口(cancel / retract)は削除に置き換わって無い。
// [] のフォルダの中のテストは pnpm test が拾わないので、ここに置く。
// - 宣言: 操作の口が access { roleCategories: ["admin"] }(門 messagingDispatches は住所の前方一致で proxy が閉じる)
// - id と body(resend の includeUnknown、空の body は {}・bulk-delete / delete-summary の { ids })をそのまま service へ渡す、service の 409 をそのまま返す
// 実行: pnpm test src/app/api/admin/messaging/dispatches/operations.test.mts

import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

import { NextRequest, NextResponse } from "next/server";

const { DomainError } = await import("@/lib/errors");

const declared: { operation: string; access: unknown }[] = [];
type Handler = (req: NextRequest, ctx: { params: Record<string, string> }) => Promise<unknown>;
const createApiRoute = (options: { operation: string; access: unknown }, handler: Handler) => {
  declared.push({ operation: options.operation, access: options.access });
  return async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      return NextResponse.json(await handler(req, { params: await ctx.params }));
    } catch (error) {
      if (error instanceof DomainError) {
        return NextResponse.json({ message: error.message, code: error.code }, { status: error.status });
      }
      throw error;
    }
  };
};
mock.module("@/wiring/apiRoute", { namedExports: { createApiRoute } });

const calls: unknown[][] = [];
let refuse = false;
const record = (name: string) => async (...args: unknown[]) => {
  calls.push([name, ...args]);
  if (refuse) throw new DomainError("送り直す失敗の配達がありません", { status: 409, code: "no_failed" });
  return { ok: name };
};
mock.module("@/domains/core/messaging/services/server/messagingService", {
  namedExports: {
    messagingService: Object.fromEntries(
      ["findDispatch", "adminDeleteDispatch", "adminBulkDeleteDispatches", "adminDispatchDeleteSummary", "adminResendFailed"].map(
        (name) => [name, record(name)],
      ),
    ),
  },
});

const one = await import("./[id]/route.ts");
const bulkDelete = await import("./bulk-delete/route.ts");
const deleteSummary = await import("./delete-summary/route.ts");
const resend = await import("./[id]/resend/route.ts");

const BASE = "http://localhost/api/admin/messaging/dispatches";
const ctx = { params: Promise.resolve({ id: "d1" }) };

beforeEach(() => {
  calls.length = 0;
  refuse = false;
});

test("宣言: 1 件の GET・DELETE・PATCH(予約の直し)・bulk-delete・delete-summary・resend の 6 つが管理者だけ", () => {
  assert.deepEqual(declared.map((entry) => entry.operation).sort(), [
    "DELETE /api/admin/messaging/dispatches/[id]",
    "GET /api/admin/messaging/dispatches/[id]",
    "PATCH /api/admin/messaging/dispatches/[id]",
    "POST /api/admin/messaging/dispatches/[id]/resend",
    "POST /api/admin/messaging/dispatches/bulk-delete",
    "POST /api/admin/messaging/dispatches/delete-summary",
  ]);
  for (const entry of declared) assert.deepEqual(entry.access, { roleCategories: ["admin"] }, entry.operation);
});

test("id と body を渡す(resend の空の body は {})", async () => {
  await one.DELETE(new NextRequest(`${BASE}/d1`, { method: "DELETE" }), ctx);
  await bulkDelete.POST(new NextRequest(`${BASE}/bulk-delete`, { method: "POST", body: JSON.stringify({ ids: ["d1", "d2"] }) }), ctx);
  await deleteSummary.POST(new NextRequest(`${BASE}/delete-summary`, { method: "POST", body: JSON.stringify({ ids: ["d1"] }) }), ctx);
  await resend.POST(new NextRequest(`${BASE}/d1/resend`, { method: "POST" }), ctx);
  await resend.POST(new NextRequest(`${BASE}/d1/resend`, { method: "POST", body: JSON.stringify({ includeUnknown: true }) }), ctx);
  assert.deepEqual(calls, [
    ["adminDeleteDispatch", "d1"],
    ["adminBulkDeleteDispatches", { ids: ["d1", "d2"] }],
    ["adminDispatchDeleteSummary", { ids: ["d1"] }],
    ["adminResendFailed", "d1", {}],
    ["adminResendFailed", "d1", { includeUnknown: true }],
  ]);
});

test("bulk-delete・delete-summary の JSON でない body は 400(service を呼ばない)", async () => {
  for (const route of [bulkDelete, deleteSummary]) {
    const res = await route.POST(new NextRequest(`${BASE}/x`, { method: "POST", body: "not json" }), ctx);
    assert.equal(res.status, 400);
  }
  assert.deepEqual(calls, []);
});

test("service の 409 と理由の符号をそのまま返す", async () => {
  refuse = true;
  const res = await resend.POST(new NextRequest(`${BASE}/d1/resend`, { method: "POST" }), ctx);
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, "no_failed");
});
