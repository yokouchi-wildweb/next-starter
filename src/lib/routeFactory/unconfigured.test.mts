// src/lib/routeFactory/unconfigured.test.mts
// 外部の口の誤りの写し(D32・D40): 選んだ実装に設定が無い → 500 + code backend_not_configured、使わないと選んだ口 → 501 + code
// backend_not_selected。本文は { message, code } だけ(口の名前・実装・足りない env の名前を載せない)、失敗の記録の口へは今どおり渡る。
// ハンドラが自分で返す 503(webhook の受け口の形)は写さずそのまま通す。実行: pnpm test src/lib/routeFactory/unconfigured.test.mts
import assert from "node:assert/strict";
import { mock, test } from "node:test";

import nextServer, { NextRequest, NextResponse } from "next/server";

// 入口の芯は最初に next/server の connection() を待つ。Next のリクエストの外(ここ)では throw するので空にする
mock.module("next/server", { namedExports: { ...nextServer, connection: async () => {} } });

const { createRouteFactories } = await import("./createRouteFactories.ts");
const { BackendNotConfiguredError } = await import("@/lib/errors");
const { BackendNoneSelectedError } = await import("@/lib/backends");

class FakeNotConfiguredError extends BackendNotConfiguredError {
  constructor() {
    super("RESEND_API_KEY が設定されていません。", { port: "mail", implementation: "resend", missing: ["RESEND_API_KEY"], side: "server" });
  }
}

function factories(reported: unknown[]) {
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
    serverError: { onServerError: async (error) => void reported.push(error) },
  });
}

const call = (handler: () => Promise<unknown>, reported: unknown[]) =>
  factories(reported).createApiRoute({ operation: "POST /api/x", operationType: "write", access: "public" }, handler)(
    new NextRequest("http://localhost/api/x", { method: "POST" }),
    { params: Promise.resolve({}) },
  );

test("選んだ実装に設定が無い: 500 + { message: 汎用, code: backend_not_configured } だけ、記録の口へ渡る", async () => {
  const reported: unknown[] = [];
  const res = await call(async () => {
    throw new FakeNotConfiguredError();
  }, reported);
  assert.equal(res.status, 500);
  const text = await res.text();
  assert.deepEqual(JSON.parse(text), { message: "サーバーでエラーが発生しました", code: "backend_not_configured" });
  for (const word of ["mail", "resend", "RESEND_API_KEY"]) assert.ok(!text.includes(word), `${word} を本文に出さない`);
  assert.equal(reported.length, 1);
  assert.ok(reported[0] instanceof FakeNotConfiguredError);
});

test("使わないと選んだ口: 501 + { message: この機能は利用できません, code: backend_not_selected } だけ、記録の口へ渡る", async () => {
  const reported: unknown[] = [];
  const res = await call(async () => {
    throw new BackendNoneSelectedError("storage");
  }, reported);
  assert.equal(res.status, 501);
  const text = await res.text();
  assert.deepEqual(JSON.parse(text), { message: "この機能は利用できません", code: "backend_not_selected" });
  assert.ok(!text.includes("storage"));
  assert.equal(reported.length, 1);
});

test("ハンドラが返す 503(webhook の受け口の形)はそのまま、ほかの例外は今どおり code の無い 500", async () => {
  const passed = await call(async () => NextResponse.json({ ok: false, error: "webhook_not_configured" }, { status: 503 }), []);
  assert.equal(passed.status, 503);
  assert.deepEqual(await passed.json(), { ok: false, error: "webhook_not_configured" });
  const plain = await call(async () => {
    throw new Error("db down");
  }, []);
  assert.equal(plain.status, 500);
  assert.deepEqual(await plain.json(), { message: "サーバーでエラーが発生しました" });
});
