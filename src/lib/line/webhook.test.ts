// src/lib/line/webhook.test.ts
//
// LINE Webhook の署名の照合 (verifySignature) の検査 (LINE・DB なし)。
// - 本文の HMAC-SHA256 (base64) と同じ署名は true
// - 違う署名・長さが違う署名・空の署名・不正な base64 は例外を出さずに false
// 実行: pnpm test src/lib/line/webhook.test.ts
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "crypto";

import { verifySignature } from "./webhook";

const SECRET = "test-channel-secret";
const BODY = JSON.stringify({ destination: "U0", events: [] });
const sign = (body: string, secret = SECRET) => createHmac("SHA256", secret).update(body).digest("base64");

before(() => {
  process.env.LINE_MESSAGING_CHANNEL_SECRET = SECRET;
  process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN = "test-token";
});

test("正しい署名は true", () => {
  assert.equal(verifySignature(BODY, sign(BODY)), true);
});

test("違う署名(別の秘密鍵・別の本文)は false", () => {
  assert.equal(verifySignature(BODY, sign(BODY, "other-secret")), false);
  assert.equal(verifySignature(BODY, sign(`${BODY} `)), false);
});

test("長さが違う署名は例外を出さずに false", () => {
  const valid = sign(BODY);
  assert.equal(verifySignature(BODY, valid.slice(0, -1)), false);
  assert.equal(verifySignature(BODY, `${valid}A`), false);
});

test("空の署名は false", () => {
  assert.equal(verifySignature(BODY, ""), false);
});

test("不正な base64(同じ長さで base64 にない文字を含む)は false", () => {
  const valid = sign(BODY);
  assert.equal(verifySignature(BODY, `${valid.slice(0, -2)}!!`), false);
  assert.equal(verifySignature(BODY, "!".repeat(valid.length)), false);
});
