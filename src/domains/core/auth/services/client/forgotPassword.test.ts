// パスワード再設定メールの送信クライアントの検査(axios の adapter を偽物に)。
// - /api/auth/forgot-password に { email } を POST する
// - 失敗はサーバーの message を持つ HttpError、message が無ければ axios のエラーの文(normalizeHttpError のとおり)
// 実行: pnpm test src/domains/core/auth/services/client/forgotPassword.test.ts
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";

import { HttpError } from "@/lib/errors";

import { sendPasswordResetEmail } from "./forgotPassword";

const calls: { url: string; data: unknown }[] = [];
let failWith: { status: number; data: unknown } | null = null;
const fakeAdapter: AxiosAdapter = async (config) => {
  calls.push({ url: config.url ?? "", data: JSON.parse(String(config.data)) });
  if (failWith) {
    const response = { data: failWith.data, status: failWith.status, statusText: "", headers: {}, config };
    throw new AxiosError("Request failed", "ERR_BAD_REQUEST", config as InternalAxiosRequestConfig, null, response);
  }
  return { data: {}, status: 200, statusText: "OK", headers: {}, config };
};
axios.defaults.adapter = fakeAdapter;

beforeEach(() => {
  calls.length = 0;
  failWith = null;
});

test("送信: /api/auth/forgot-password に email を POST する", async () => {
  await sendPasswordResetEmail("a@example.com");
  assert.deepEqual(calls, [{ url: "/api/auth/forgot-password", data: { email: "a@example.com" } }]);
});

test("失敗: サーバーの message を持つ HttpError、無ければ axios のエラーの文", async () => {
  failWith = { status: 429, data: { message: "しばらく待ってください" } };
  await assert.rejects(sendPasswordResetEmail("a@example.com"), (e: unknown) => {
    assert.ok(e instanceof HttpError);
    assert.equal(e.message, "しばらく待ってください");
    assert.equal(e.status, 429);
    return true;
  });
  failWith = { status: 500, data: {} };
  await assert.rejects(sendPasswordResetEmail("a@example.com"), (e: unknown) => {
    assert.ok(e instanceof HttpError);
    assert.equal(e.message, "Request failed");
    assert.equal(e.status, 500);
    return true;
  });
});
