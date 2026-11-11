// src/lib/line/messagingApi.test.ts
//
// Messaging API の送信の検査(外部通信なし。fetch と設定を偽物に差し替える)。
// - 失敗は LineApiError(status・retryable・body): 429・5xx・応答なし = retryable / 他の 4xx = not
// - push の X-Line-Retry-Key(lineRetryKey で作る UUID)。鍵つきの 409 = 受付済み = 成功、鍵なしの 409 = 失敗
// 実行: pnpm test src/lib/line/messagingApi.test.ts
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { after, afterEach, before, mock, test } from "node:test";
import assert from "node:assert/strict";

mock.module("./env", {
  namedExports: { getLineMessagingConfig: () => ({ channelAccessToken: "token", channelSecret: "secret" }) },
});

type Call = { url: string; headers: Record<string, string> };
const calls: Call[] = [];
const realFetch = globalThis.fetch;
let respond: () => Promise<Response> = async () => new Response(JSON.stringify({ sentMessages: [{ id: "m1" }] }), { status: 200 });

let api: typeof import("./messagingApi");
let LineApiError: typeof import("./errors").LineApiError;
let lineRetryKey: typeof import("./retryKey").lineRetryKey;

before(async () => {
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: (init?.headers ?? {}) as Record<string, string> });
    return respond();
  }) as typeof fetch;
  api = await import("./messagingApi");
  ({ LineApiError } = await import("./errors"));
  ({ lineRetryKey } = await import("./retryKey"));
});

after(() => {
  globalThis.fetch = realFetch;
});

afterEach(() => {
  calls.length = 0;
  respond = async () => new Response(JSON.stringify({ sentMessages: [{ id: "m1" }] }), { status: 200 });
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function expectLineError(run: () => Promise<unknown>, expected: { status: number | null; retryable: boolean; body?: string | null }) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof LineApiError);
    assert.equal(error.status, expected.status);
    assert.equal(error.retryable, expected.retryable);
    if (expected.body !== undefined) assert.equal(error.body, expected.body);
    assert.match(error.message, /^LINE Messaging API エラー: /);
    return true;
  });
}

test("push: 再試行の鍵を X-Line-Retry-Key で付け、無ければ付けない", async () => {
  const key = lineRetryKey("delivery-1");
  const result = await api.pushMessage("U1", [api.textMessage("やあ")], { retryKey: key });
  assert.deepEqual(result, { sentMessages: [{ id: "m1" }] });
  assert.equal(calls[0].headers["X-Line-Retry-Key"], key);
  await api.pushMessage("U1", [api.textMessage("やあ")]);
  assert.equal("X-Line-Retry-Key" in calls[1].headers, false);
});

test("push: 鍵つきの 409(受付済み)は成功として本文を返す。鍵なしの 409 は失敗", async () => {
  respond = async () => new Response(JSON.stringify({ message: "The retry key is already accepted", sentMessages: [{ id: "m0" }] }), { status: 409 });
  const result = await api.pushMessage("U1", [api.textMessage("やあ")], { retryKey: lineRetryKey("d") });
  assert.deepEqual(result.sentMessages, [{ id: "m0" }]);
  await expectLineError(() => api.pushMessage("U1", [api.textMessage("やあ")]), { status: 409, retryable: false });
});

test("失敗の型: 429・5xx = retryable、他の 4xx = not、LINE の本文を残す", async () => {
  for (const [status, retryable] of [[429, true], [500, true], [503, true], [400, false], [403, false]] as const) {
    respond = async () => new Response(`{"message":"e${status}"}`, { status });
    await expectLineError(() => api.pushMessage("U1", [api.textMessage("x")]), { status, retryable, body: `{"message":"e${status}"}` });
  }
});

test("応答なし(fetch が投げた)= status null・retryable、他の送り口も同じ型", async () => {
  respond = async () => {
    throw new TypeError("fetch failed");
  };
  await expectLineError(() => api.pushMessage("U1", [api.textMessage("x")]), { status: null, retryable: true, body: null });
  await expectLineError(() => api.broadcast([api.textMessage("x")]), { status: null, retryable: true });
});

test("lineRetryKey: 同じ鍵は同じ UUID(v5 の形)、違う鍵は違う UUID、空は投げる", () => {
  const a = lineRetryKey("delivery-1");
  assert.match(a, UUID);
  assert.equal(lineRetryKey("delivery-1"), a);
  assert.notEqual(lineRetryKey("delivery-1:1"), a);
  assert.throws(() => lineRetryKey(""));
});
