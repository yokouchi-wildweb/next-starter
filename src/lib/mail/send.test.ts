// src/lib/mail/send.test.ts
//
// lib/mail の send() の検査(外部通信なし。Resend / SendGrid の SDK を偽物に差し替え、選択の生成物 ./extensions/mail を
// 本物の項目 plugs/mail/resend・sendgrid のどちらかへ向ける)。
// - 戻り値 { provider, providerMessageId }・headers と idempotencyKey の渡し方・失敗の分類(一時 / 恒久 / 受付不明)
// - 本文の 2 つの渡し方(react / 描き終えた html + text)
// - 選択の守り: env MAIL_PROVIDER が選んだ実装と違えば送る前に MailProviderMismatchError(鍵でない値は compat の既定 resend と読む)
// - 鍵が無ければ MailNotConfiguredError(文言は従来どおり)、isConfigured は通信なしで同じ判定
// 実行: pnpm test src/lib/mail/send.test.ts
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { afterEach, before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";

import type { MailAdapter } from "./adapter";

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

// resend は ESM と CJS の 2 つの入口を持つ: 項目が読む方(tsx は CJS で読む)を解いた先で差し替える
mock.module(require.resolve("resend"), {
  namedExports: {
    Resend: class {
      emails = {
        send: async (payload: Record<string, unknown>, options: unknown) => {
          resendCalls.push({ payload, options });
          return resendResult;
        },
      };
    },
  },
});

mock.module("@sendgrid/mail", {
  defaultExport: {
    setApiKey: () => {},
    send: async (payload: Record<string, unknown>) => {
      sendgridCalls.push(payload);
      return sendgridImpl();
    },
  },
});

mock.module("./config", {
  namedExports: {
    mailConfig: { defaultFrom: "from@example.com", defaultFromName: "差出人" },
  },
});

// 選択の生成物の差し替え: 選んだ名前を切り替えると、本物の項目の adapter へ向く
const COMPAT = { from: "env", name: "MAIL_PROVIDER", map: { sendgrid: "sendgrid", resend: "resend" }, default: "resend" } as const;
let selectedName: "resend" | "sendgrid" = "resend";
const items: Record<string, MailAdapter> = {};
mock.module("./extensions/mail", {
  namedExports: {
    adapter: {
      isConfigured: () => items[selectedName].isConfigured(),
      send: (params: Parameters<MailAdapter["send"]>[0]) => items[selectedName].send(params),
    },
    get selected() {
      return selectedName;
    },
    compat: COMPAT,
  },
});
const use = (name: "resend" | "sendgrid") => {
  selectedName = name;
};

let send: typeof import("./send").send;
let MailSendError: typeof import("./errors").MailSendError;
let MailNotConfiguredError: typeof import("./selectionErrors").MailNotConfiguredError;
let MailProviderMismatchError: typeof import("./selectionErrors").MailProviderMismatchError;
let BackendNotConfiguredError: typeof import("@/lib/errors").BackendNotConfiguredError;

before(async () => {
  ({ send } = await import("./send"));
  ({ MailSendError } = await import("./errors"));
  ({ MailNotConfiguredError, MailProviderMismatchError } = await import("./selectionErrors"));
  ({ BackendNotConfiguredError } = await import("@/lib/errors"));
  items.resend = (await import("./plugs/mail/resend")).adapter;
  items.sendgrid = (await import("./plugs/mail/sendgrid")).adapter;
});

afterEach(() => {
  resendCalls.length = 0;
  sendgridCalls.length = 0;
  resendResult = { data: { id: "re_1" }, error: null };
  sendgridImpl = async () => [
    { statusCode: 202, headers: { "x-message-id": "sg_1" }, body: "" },
    {},
  ];
  use("resend");
  delete process.env.MAIL_PROVIDER;
  process.env.RESEND_API_KEY = "re_key";
  process.env.SENDGRID_API_KEY = "sg_key";
});

// --- 鍵が無い(クライアントを作る前に。最初に流す: クライアントは 1 度作ると使い回す) ---

test("鍵が無い: MailNotConfiguredError(未設定の共通の親の子、文言は従来どおり)、isConfigured は configured: false", async () => {
  delete process.env.RESEND_API_KEY;
  delete process.env.SENDGRID_API_KEY;
  for (const [name, key] of [["resend", "RESEND_API_KEY"], ["sendgrid", "SENDGRID_API_KEY"]] as const) {
    use(name);
    assert.deepEqual(items[name].isConfigured(), { configured: false, missing: [key] });
    await assert.rejects(
      send({ to: "to@example.com", subject: "件名", html: "<p>x</p>" }),
      (error: unknown) => {
        assert.ok(error instanceof MailNotConfiguredError);
        assert.ok(error instanceof BackendNotConfiguredError);
        assert.equal(error.message, `${key} が設定されていません。環境変数を確認してください。`);
        assert.equal(error.port, "mail");
        assert.equal(error.implementation, name);
        assert.deepEqual(error.missing, [key]);
        return true;
      },
    );
  }
  process.env.RESEND_API_KEY = "re_key";
  assert.deepEqual(items.resend.isConfigured(), { configured: true });
});

// --- 選択の守り ---

test("食い違い: MAIL_PROVIDER が選んだ実装と違えば送る前に投げ、env の値は文言に出さない。同じなら送る", async () => {
  process.env.MAIL_PROVIDER = "sendgrid";
  await assert.rejects(send(base), (error: unknown) => {
    assert.ok(error instanceof MailProviderMismatchError);
    assert.equal(error.selected, "resend");
    assert.equal(error.fromEnv, "sendgrid");
    assert.match(error.message, /pnpm workflow backend-selection set mail/);
    return true;
  });
  assert.equal(resendCalls.length, 0);
  assert.equal(sendgridCalls.length, 0);
  process.env.MAIL_PROVIDER = "resend";
  assert.deepEqual(await send(base), { provider: "resend", providerMessageId: "re_1" });
  use("sendgrid");
  process.env.MAIL_PROVIDER = " sendgrid ";
  assert.deepEqual(await send(base), { provider: "sendgrid", providerMessageId: "sg_1" });
});

test("知らない値: MAIL_PROVIDER が compat の鍵でなければ既定 resend と読む(選択 resend なら送る、sendgrid なら投げる)", async () => {
  process.env.MAIL_PROVIDER = "smtp-x";
  assert.deepEqual(await send(base), { provider: "resend", providerMessageId: "re_1" });
  assert.equal(resendCalls.length, 1);
  use("sendgrid");
  await assert.rejects(send(base), (error: unknown) => {
    assert.ok(error instanceof MailProviderMismatchError);
    assert.equal(error.selected, "sendgrid");
    assert.equal(error.fromEnv, "resend");
    assert.doesNotMatch(error.message, /smtp-x/);
    return true;
  });
  assert.equal(sendgridCalls.length, 0);
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
  use("sendgrid");
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
  use("sendgrid");
  sendgridImpl = async () => [{ statusCode: 202, headers: {}, body: "" }, {}];
  const result = await send(base);
  assert.deepEqual(result, { provider: "sendgrid", providerMessageId: null });
});

function responseError(code: number, message: string) {
  return Object.assign(new Error(message), { code, response: { headers: {}, body: "" } });
}

test("SendGrid: ResponseError の code で分類(429・5xx = transient / 4xx = permanent)", async () => {
  use("sendgrid");
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
  use("sendgrid");
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

test("tags: Resend は tags([{ name, value }])、SendGrid は customArgs で渡し、無ければ渡さない", async () => {
  await send({ ...base, tags: { delivery_id: "d-1" } });
  assert.deepEqual(resendCalls[0].payload.tags, [{ name: "delivery_id", value: "d-1" }]);
  await send(base);
  assert.equal("tags" in resendCalls[1].payload, false);

  use("sendgrid");
  await send({ ...base, tags: { delivery_id: "d-2" } });
  assert.deepEqual(sendgridCalls.at(-1)?.customArgs, { delivery_id: "d-2" });
  await send(base);
  assert.equal("customArgs" in (sendgridCalls.at(-1) ?? {}), false);
});

// --- 描き終えた html を渡す口 ---

test("html: Resend は html と text をそのまま渡し、react を渡さない", async () => {
  await send({ to: "to@example.com", subject: "件名", html: "<p>描いた本文</p>", text: "描いた本文" });
  assert.equal(resendCalls[0].payload.html, "<p>描いた本文</p>");
  assert.equal(resendCalls[0].payload.text, "描いた本文");
  assert.equal("react" in resendCalls[0].payload, false);
  await send({ to: "to@example.com", subject: "件名", html: "<p>x</p>" });
  assert.equal("text" in resendCalls[1].payload, false);
});

test("html: SendGrid は描かずに html(と text)を送る。react の時は今どおり描く", async () => {
  use("sendgrid");
  await send({ to: "to@example.com", subject: "件名", html: "<p>描いた本文</p>", text: "描いた本文" });
  assert.equal(sendgridCalls[0].html, "<p>描いた本文</p>");
  assert.equal(sendgridCalls[0].text, "描いた本文");
  await send(base);
  assert.match(String(sendgridCalls[1].html), /<p>本文<\/p>/);
  assert.equal("text" in sendgridCalls[1], false);
});
