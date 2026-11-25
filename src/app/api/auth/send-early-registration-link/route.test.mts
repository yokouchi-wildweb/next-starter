// src/app/api/auth/send-early-registration-link/route.test.mts
// 先行登録リンクの送信: 使い捨てメールは黙って止める(利用者には成功を返し、メールは送らない)が、失敗の記録は 1 行残す
// (signupAudit。ルートファクトリーは本物、DB・メール・回数制限だけモック)
// 実行: pnpm test src/app/api/auth/send-early-registration-link/route.test.mts

import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

import nextServer, { NextRequest } from "next/server";

// 入口の芯は最初に next/server の connection() を待つ。Next のリクエストの外では throw するので connection だけ空にする
mock.module("next/server", { namedExports: { ...nextServer, connection: async () => {} } });

let disposable = false;
const failures: Array<Record<string, unknown>> = [];
const sent: string[] = [];
mock.module("@/lib/spamGuard", { namedExports: { isDisposableEmail: async () => disposable } });
mock.module("@/domains/core/auth/services/server/signupAudit", {
  namedExports: { recordSignupFailure: async (input: Record<string, unknown>) => void failures.push(input) },
});
mock.module("@/domains/core/auth/services/server/sendEarlyRegistrationLink", {
  namedExports: { sendEarlyRegistrationLink: async ({ email }: { email: string }) => void sent.push(email) },
});
mock.module("next/headers", { namedExports: { cookies: async () => ({ get: () => undefined }) } });
mock.module("@/domains/core/auth/services/server/session/getTokenOnlySession", { namedExports: { getTokenOnlySession: async () => null } });
mock.module("@/domains/core/rateLimit/services/server/wrappers/rateLimitHelper", {
  namedExports: { checkRateLimit: async () => ({ allowed: true }) },
});

const { POST } = await import("./route.ts");

const call = (body: unknown) =>
  POST(
    new NextRequest("http://localhost/api/auth/send-early-registration-link", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({}) },
  );

beforeEach(() => {
  failures.length = 0;
  sent.length = 0;
});

test("使い捨てメール: 成功を返しメールは送らず、失敗の記録を 1 行(disposable_email)", async () => {
  disposable = true;
  const res = await call({ email: "x@spam.test" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { success: true });
  assert.deepEqual(sent, []);
  assert.deepEqual(failures, [{ flow: "early_registration_link", reason: "disposable_email", email: "x@spam.test" }]);
});

test("メールが無い: 400 のまま、失敗の記録を 1 行(invalid_email)。ふつうのメールは送って記録しない", async () => {
  disposable = false;
  const bad = await call({});
  assert.equal(bad.status, 400);
  assert.deepEqual(failures, [{ flow: "early_registration_link", reason: "invalid_email", email: null }]);
  failures.length = 0;
  const ok = await call({ email: "a@example.test" });
  assert.equal(ok.status, 200);
  assert.deepEqual(sent, ["a@example.test"]);
  assert.deepEqual(failures, []);
});
