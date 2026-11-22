// 判定デモのクライアントの検査(axios の adapter を偽物に)。
// - file だけ / ストリクトの期待値つきの FormData を /api/demo/bank-transfer-vision に送る
// - 失敗はサーバーの message を持つ HttpError
// 実行: pnpm test src/domains/core/demo/services/client/bankTransferVision.test.ts
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";

import { HttpError } from "@/lib/errors";

import { judgeDemoBankTransferImage } from "./bankTransferVision";

const sent: FormData[] = [];
let fail: { status: number; data: unknown } | null = null;
const fakeAdapter: AxiosAdapter = async (config) => {
  assert.equal(config.url, "/api/demo/bank-transfer-vision");
  sent.push(config.data as FormData);
  if (fail) {
    const response = { data: fail.data, status: fail.status, statusText: "", headers: {}, config };
    throw new AxiosError("Request failed", "ERR_BAD_REQUEST", config as InternalAxiosRequestConfig, null, response);
  }
  return { data: { isLikelyBankTransfer: true, confidence: 0.8, imageType: "screenshot", reason: "r" }, status: 200, statusText: "OK", headers: {}, config };
};
axios.defaults.adapter = fakeAdapter;

beforeEach(() => {
  sent.length = 0;
  fail = null;
});

test("file だけ: 期待値の欄を送らない", async () => {
  const result = await judgeDemoBankTransferImage({ file: new File(["x"], "a.png") });
  assert.equal(result.imageType, "screenshot");
  assert.deepEqual([...sent[0].keys()], ["file"]);
});

test("ストリクト: 識別数字と金額(文字)を足す", async () => {
  await judgeDemoBankTransferImage({ file: new File(["x"], "a.png"), strict: { expectedIdentifier: "123", expectedAmount: 5000 } });
  assert.equal(sent[0].get("expectedIdentifier"), "123");
  assert.equal(sent[0].get("expectedAmount"), "5000");
});

test("失敗: サーバーの message を持つ HttpError", async () => {
  fail = { status: 400, data: { message: "画像が読めません" } };
  await assert.rejects(judgeDemoBankTransferImage({ file: new File(["x"], "a.png") }), (e: unknown) => {
    assert.ok(e instanceof HttpError);
    assert.equal(e.message, "画像が読めません");
    return true;
  });
});
