// src/app/api/admin/messaging/dispatches/operations.test.mts
// /api/admin/messaging/dispatches/[id]/{cancel, retract, resend} の検査(Factory・messaging の service は偽物)。
// [] のフォルダの中のテストは pnpm test が拾わないので、ここに置く。
// - 宣言: 3 つの口が access { roleCategories: ["admin"] }(門 messagingDispatches は住所の前方一致で proxy が閉じる)
// - id と body(resend の includeUnknown、空の body は {})をそのまま service へ渡す、service の 409 をそのまま返す
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
  if (refuse) throw new DomainError("取り下げた回です", { status: 409, code: "retracted" });
  return { ok: name };
};
mock.module("@/features/core/messaging/services/server/messagingService", {
  namedExports: {
    messagingService: Object.fromEntries(["adminCancelScheduled", "adminRetract", "adminResendFailed"].map((name) => [name, record(name)])),
  },
});

const cancel = await import("./[id]/cancel/route.ts");
const retract = await import("./[id]/retract/route.ts");
const resend = await import("./[id]/resend/route.ts");

const BASE = "http://localhost/api/admin/messaging/dispatches/d1";
const ctx = { params: Promise.resolve({ id: "d1" }) };

beforeEach(() => {
  calls.length = 0;
  refuse = false;
});

test("宣言: 3 つの口が管理者だけ", () => {
  assert.equal(declared.length, 3);
  for (const entry of declared) assert.deepEqual(entry.access, { roleCategories: ["admin"] }, entry.operation);
});

test("id と body を渡す(空の body は {})", async () => {
  await cancel.POST(new NextRequest(`${BASE}/cancel`, { method: "POST" }), ctx);
  await retract.POST(new NextRequest(`${BASE}/retract`, { method: "POST" }), ctx);
  await resend.POST(new NextRequest(`${BASE}/resend`, { method: "POST" }), ctx);
  await resend.POST(new NextRequest(`${BASE}/resend`, { method: "POST", body: JSON.stringify({ includeUnknown: true }) }), ctx);
  assert.deepEqual(calls, [
    ["adminCancelScheduled", "d1"],
    ["adminRetract", "d1"],
    ["adminResendFailed", "d1", {}],
    ["adminResendFailed", "d1", { includeUnknown: true }],
  ]);
});

test("service の 409 と理由の符号をそのまま返す", async () => {
  refuse = true;
  const res = await retract.POST(new NextRequest(`${BASE}/retract`, { method: "POST" }), ctx);
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, "retracted");
});
