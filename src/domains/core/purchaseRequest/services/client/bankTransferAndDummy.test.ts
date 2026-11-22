// 振込画像の判定とダミー決済の webhook のクライアントの検査(axios の adapter を偽物に)。
// - judgeBankTransferImage: judge-image の口に file を FormData で POST し、応答をそのまま返す。429 は responseData.rateLimit を保つ HttpError
// - notifyDummyPayment: event_type・session_id・payment_method(null は落とす)を dummy の webhook に POST する
// 実行: pnpm test src/domains/core/purchaseRequest/services/client/bankTransferAndDummy.test.ts
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";

import { HttpError } from "@/lib/errors";

import { judgeBankTransferImage, notifyDummyPayment } from "./purchaseRequestClient";

const calls: { url: string; data: unknown }[] = [];
let respond: { status: number; data: unknown } = { status: 200, data: {} };
const fakeAdapter: AxiosAdapter = async (config) => {
  calls.push({ url: config.url ?? "", data: config.data });
  if (respond.status >= 400) {
    const response = { data: respond.data, status: respond.status, statusText: "", headers: {}, config };
    throw new AxiosError("Request failed", "ERR_BAD_REQUEST", config as InternalAxiosRequestConfig, null, response);
  }
  return { data: respond.data, status: respond.status, statusText: "OK", headers: {}, config };
};
axios.defaults.adapter = fakeAdapter;

const RATE_LIMIT = { remainingFailures15m: 0, remainingAttempts24h: 10, resetAt15m: "2026-11-18T05:00:00Z", resetAt24h: null };

beforeEach(() => {
  calls.length = 0;
  respond = { status: 200, data: {} };
});

test("判定: judge-image の口に file を FormData で送り、応答を返す", async () => {
  const result = { passed: true, isLikelyBankTransfer: true, confidence: 0.9, imageType: "photo", reason: "ok", rateLimit: RATE_LIMIT };
  respond = { status: 200, data: result };
  const file = new File(["x"], "a.png", { type: "image/png" });
  assert.deepEqual(await judgeBankTransferImage("req-1", file), result);
  assert.equal(calls[0].url, "/api/wallet/purchase/req-1/bank-transfer/judge-image");
  assert.ok(calls[0].data instanceof FormData);
  assert.equal(((calls[0].data as FormData).get("file") as File).name, "a.png");
});

test("判定の 429: message と responseData.rateLimit を持つ HttpError", async () => {
  respond = { status: 429, data: { message: "回数の上限です", rateLimit: RATE_LIMIT } };
  await assert.rejects(judgeBankTransferImage("req-1", new File(["x"], "a.png")), (e: unknown) => {
    assert.ok(e instanceof HttpError);
    assert.equal(e.message, "回数の上限です");
    assert.deepEqual((e.responseData as { rateLimit: unknown }).rateLimit, RATE_LIMIT);
    return true;
  });
});

test("ダミー決済: 成功・失敗の event_type と session_id・payment_method を送り、null の方法は落とす", async () => {
  await notifyDummyPayment({ success: true, sessionId: "s1", paymentMethod: "paypay" });
  await notifyDummyPayment({ success: false, sessionId: "s2", paymentMethod: null });
  assert.deepEqual(
    calls.map((c) => ({ url: c.url, data: JSON.parse(String(c.data)) })),
    [
      { url: "/api/webhook/payment?provider=dummy", data: { event_type: "payment.completed", session_id: "s1", payment_method: "paypay" } },
      { url: "/api/webhook/payment?provider=dummy", data: { event_type: "payment.failed", session_id: "s2" } },
    ],
  );
});

test("ダミー決済の失敗: 状態を持つ HttpError(画面の文言はフックが固定の文で出す)", async () => {
  respond = { status: 500, data: {} };
  await assert.rejects(notifyDummyPayment({ success: true, sessionId: "s1" }), (e: unknown) => {
    assert.ok(e instanceof HttpError);
    assert.equal(e.status, 500);
    return true;
  });
});
