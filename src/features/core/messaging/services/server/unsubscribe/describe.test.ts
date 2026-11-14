// describeUnsubscribeTokenWith の検査(確認のページが見せる中身)。
// 実行: pnpm test src/features/core/messaging/services/server/unsubscribe/describe.test.ts
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import { describeUnsubscribeTokenWith } from "./describe";
import { UNSUBSCRIBE_SECRET_ENV, signUnsubscribeToken } from "./token";

const USER = "user:3f1c2b9a-1d2e-4f50-8a9b-0c1d2e3f4a5b";
const saved = process.env[UNSUBSCRIBE_SECRET_ENV];
beforeEach(() => {
  process.env[UNSUBSCRIBE_SECRET_ENV] = "test-secret";
});
afterEach(() => {
  if (saved === undefined) delete process.env[UNSUBSCRIBE_SECRET_ENV];
  else process.env[UNSUBSCRIBE_SECRET_ENV] = saved;
});
const lists = { categories: { marketing: { label: "キャンペーン情報" } }, channels: { email: { label: "メール" } } };

test("正しいトークン → 種類と経路の表示名", () => {
  const token = signUnsubscribeToken({ recipientKey: USER, category: "marketing", channel: "email" });
  assert.deepEqual(describeUnsubscribeTokenWith(lists, token), { valid: true, categoryLabel: "キャンペーン情報", channelLabel: "メール" });
});

test("受け口に無い鍵は鍵のまま", () => {
  const token = signUnsubscribeToken({ recipientKey: USER, category: "gone", channel: "line" });
  assert.deepEqual(describeUnsubscribeTokenWith(lists, token), { valid: true, categoryLabel: "gone", channelLabel: "line" });
});

test("無い・壊れた・別の鍵で署名したトークンは valid false", () => {
  assert.deepEqual(describeUnsubscribeTokenWith(lists, null), { valid: false });
  assert.deepEqual(describeUnsubscribeTokenWith(lists, "x.y"), { valid: false });
  const token = signUnsubscribeToken({ recipientKey: USER, category: "marketing", channel: "email" });
  process.env[UNSUBSCRIBE_SECRET_ENV] = "other";
  assert.deepEqual(describeUnsubscribeTokenWith(lists, token), { valid: false });
});
