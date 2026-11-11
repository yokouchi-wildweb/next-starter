// src/lib/mail/send.test.ts
//
// lib/mail の send() の検査(外部通信なし。Resend / SendGrid の client を偽物に差し替える)。
// - 戻り値 { provider, providerMessageId }・headers と idempotencyKey の渡し方・失敗の分類(一時 / 恒久 / 受付不明)
// 実行: pnpm test src/lib/mail/send.test.ts
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { afterEach, before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";

type ResendCall = { payload: Record<string, unknown>; options: unknown };
type ResendResult = {
  data: { id: string } | null;
  error: { name: string; statusCode: number | null; message: string } | null;
};

const resendCalls: ResendCall[] = [];
let resendResult: ResendResult = { data: { id: "re_1" }, error: null };

const sendgridCalls: Record<string, unknown>[] = [];
let sendgridImpl: () => Promise<unknown> = async () => [
  { statusCode: 202, headers: { "x-message-id": "sg_1" }, body: "" },
  {},
];

mock.module("./resend", {
  namedExports: {
    getResendClient: () => ({
      emails: {
        send: async (payload: Record<string, unknown>, options: unknown) => {
          resendCalls.push({ payload, options });
          return resendResult;
        },
      },
    }),
  },
});

mock.module("./sendgrid", {
  namedExports: {
    getSendGridClient: () => ({
      send: async (payload: Record<string, unknown>) => {
        sendgridCalls.push(payload);
        return sendgridImpl();
      },
    }),
  },
});

mock.module("./config", {
  namedExports: {
    mailConfig: { defaultFrom: "from@example.com", defaultFromName: "差出人" },
  },
});

let send: typeof import("./send").send;
let MailSendError: typeof import("./errors").MailSendError;

before(async () => {
  ({ send } = await import("./send"));
  ({ MailSendError } = await import("./errors"));
});

afterEach(() => {
  resendCalls.length = 0;
  sendgridCalls.length = 0;
  resendResult = { data: { id: "re_1" }, error: null };
  sendgridImpl = async () => [
    { statusCode: 202, headers: { "x-message-id": "sg_1" }, body: "" },
    {},
  ];
  delete process.env.MAIL_PROVIDER;
});

const base = {
  to: "to@example.com",
  subject: "件名",
  react: createElement("p", null, "本文"),
};

async function expectMailError(
  run: () => Promise<unknown>,
  expected: { kind: string; provider: string; status: number | null; message?: RegExp },
) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof MailSendError);
    assert.ok(error instanceof Error);
    assert.equal(error.kind, expected.kind);
    assert.equal(error.provider, expected.provider);
    assert.equal(error.status, expected.status);
    if (expected.message) assert.match(error.message, expected.message);
    return true;
  });
}

// --- Resend ---

test("Resend: data.id を providerMessageId で返す", async () => {
  const result = await send(base);
  assert.deepEqual(result, { provider: "resend", providerMessageId: "re_1" });
  assert.equal(resendCalls[0].payload.from, "差出人 <from@example.com>");
});

test("Resend: headers を渡し、idempotencyKey を SDK の options で渡す", async () => {
  await send({
    ...base,
    headers: { "List-Unsubscribe": "<https://example.com/u>" },
    idempotencyKey: "delivery-1",
  });
  assert.deepEqual(resendCalls[0].payload.headers, {
    "List-Unsubscribe": "<https://example.com/u>",
  });
  assert.deepEqual(resendCalls[0].options, { idempotencyKey: "delivery-1" });
});

test("Resend: headers / idempotencyKey が無ければ渡さない(今の呼び手と同じ要求)", async () => {
  await send(base);
  assert.equal("headers" in resendCalls[0].payload, false);
  assert.equal(resendCalls[0].options, undefined);
});

test("Resend: 429 と 5xx は transient、message は従来の文言", async () => {
  resendResult = {
    data: null,
    error: { name: "rate_limit_exceeded", statusCode: 429, message: "too many" },
  };
  await expectMailError(() => send(base), {
    kind: "transient",
    provider: "resend",
    status: 429,
    message: /^メール送信に失敗しました（Resend）: too many$/,
  });
  resendResult = {
    data: null,
    error: { name: "internal_server_error", statusCode: 500, message: "boom" },
  };
  await expectMailError(() => send(base), { kind: "transient", provider: "resend", status: 500 });
});

test("Resend: 429 以外の 4xx は permanent、処理中の冪等の 409 は transient", async () => {
  resendResult = {
    data: null,
    error: { name: "validation_error", statusCode: 422, message: "invalid to" },
  };
  await expectMailError(() => send(base), { kind: "permanent", provider: "resend", status: 422 });
  resendResult = {
    data: null,
    error: { name: "invalid_idempotent_request", statusCode: 409, message: "diff" },
  };
  await expectMailError(() => send(base), { kind: "permanent", provider: "resend", status: 409 });
  resendResult = {
    data: null,
    error: { name: "concurrent_idempotent_requests", statusCode: 409, message: "busy" },
  };
  await expectMailError(() => send(base), { kind: "transient", provider: "resend", status: 409 });
});

test("Resend: 応答の無い失敗は unknown、SDK の送信前の入力の誤りは permanent", async () => {
  resendResult = {
    data: null,
    error: { name: "application_error", statusCode: null, message: "Unable to fetch data." },
  };
  await expectMailError(() => send(base), { kind: "unknown", provider: "resend", status: null });
  resendResult = {
    data: null,
    error: { name: "missing_required_field", statusCode: null, message: "Missing `to`" },
  };
  await expectMailError(() => send(base), { kind: "permanent", provider: "resend", status: null });
});

// --- SendGrid ---

test("SendGrid: 応答ヘッダ x-message-id を providerMessageId で返し、headers を渡し、idempotencyKey は捨てる", async () => {
  process.env.MAIL_PROVIDER = "sendgrid";
  const result = await send({
    ...base,
    headers: { "List-Unsubscribe": "<https://example.com/u>" },
    idempotencyKey: "delivery-1",
  });
  assert.deepEqual(result, { provider: "sendgrid", providerMessageId: "sg_1" });
  assert.deepEqual(sendgridCalls[0].headers, { "List-Unsubscribe": "<https://example.com/u>" });
  assert.equal("idempotencyKey" in sendgridCalls[0], false);
  assert.deepEqual(sendgridCalls[0].from, { email: "from@example.com", name: "差出人" });
  assert.match(String(sendgridCalls[0].html), /<p>本文<\/p>/);
});

test("SendGrid: x-message-id が無ければ null", async () => {
  process.env.MAIL_PROVIDER = "sendgrid";
  sendgridImpl = async () => [{ statusCode: 202, headers: {}, body: "" }, {}];
  const result = await send(base);
  assert.deepEqual(result, { provider: "sendgrid", providerMessageId: null });
});

function responseError(code: number, message: string) {
  return Object.assign(new Error(message), { code, response: { headers: {}, body: "" } });
}

test("SendGrid: ResponseError の code で分類(429・5xx = transient / 4xx = permanent)", async () => {
  process.env.MAIL_PROVIDER = "sendgrid";
  sendgridImpl = async () => {
    throw responseError(429, "Too Many Requests");
  };
  await expectMailError(() => send(base), {
    kind: "transient",
    provider: "sendgrid",
    status: 429,
    message: /^メール送信に失敗しました（SendGrid）: Too Many Requests$/,
  });
  sendgridImpl = async () => {
    throw responseError(503, "Service Unavailable");
  };
  await expectMailError(() => send(base), { kind: "transient", provider: "sendgrid", status: 503 });
  sendgridImpl = async () => {
    throw responseError(400, "Bad Request");
  };
  await expectMailError(() => send(base), { kind: "permanent", provider: "sendgrid", status: 400 });
});

test("SendGrid: 接続前の誤りは transient、タイムアウトなど送られたか分からない誤りは unknown", async () => {
  process.env.MAIL_PROVIDER = "sendgrid";
  sendgridImpl = async () => {
    throw Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
  };
  await expectMailError(() => send(base), { kind: "transient", provider: "sendgrid", status: null });
  sendgridImpl = async () => {
    throw Object.assign(new Error("timeout of 0ms exceeded"), { code: "ECONNABORTED" });
  };
  await expectMailError(() => send(base), { kind: "unknown", provider: "sendgrid", status: null });
  sendgridImpl = async () => {
    throw new Error("socket hang up");
  };
  await expectMailError(() => send(base), { kind: "unknown", provider: "sendgrid", status: null });
});
