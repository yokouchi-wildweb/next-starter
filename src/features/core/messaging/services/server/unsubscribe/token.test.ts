// ワンクリックの配信停止のトークンの検査
// - 作って確かめると中身が戻る(宛先の hash・連絡の鍵・回の id つきも。mk / d の無い前のトークンも通る)
// - 中身・署名の改ざん、版の違い、形の誤り、鍵の違い、鍵が無い → null
// - URL は getAppBaseUrl() の起点 + /api/messaging/unsubscribe?token=(One-Click)/ /unsubscribe?token=(人が開くページ)
// - unsubscribePageUrlForToken: 受け取ったトークンの字のままページの URL(無ければ /unsubscribe だけ)
// 実行: pnpm test src/features/core/messaging/services/server/unsubscribe
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import {
  buildUnsubscribePageUrl,
  unsubscribePageUrlOf,
  unsubscribePageUrlForToken,
  UNSUBSCRIBE_SECRET_ENV,
  buildUnsubscribeUrl,
  isUnsubscribeConfigured,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from "./token";

const USER = "user:3f1c2b9a-1d2e-4f50-8a9b-0c1d2e3f4a5b";
const HASH = "a".repeat(64);
const DISPATCH = "0b8e2c1d-3f4a-4b5c-9d6e-7f8a9b0c1d2e";
const saved = { secret: process.env[UNSUBSCRIBE_SECRET_ENV], base: process.env.APP_BASE_URL };

beforeEach(() => {
  process.env[UNSUBSCRIBE_SECRET_ENV] = "test-secret";
  process.env.APP_BASE_URL = "https://app.example.test";
});
afterEach(() => {
  for (const [key, value] of [[UNSUBSCRIBE_SECRET_ENV, saved.secret], ["APP_BASE_URL", saved.base]] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const forge = (wire: unknown, secret = "test-secret") => {
  const body = Buffer.from(JSON.stringify(wire)).toString("base64url");
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
};

test("作って確かめると中身が戻る", () => {
  const payload = { recipientKey: USER, category: "marketing", channel: "email" };
  assert.deepEqual(verifyUnsubscribeToken(signUnsubscribeToken(payload)), payload);
  const address = { recipientKey: `addr:${HASH}`, category: "activity", channel: "email", addressHash: HASH };
  assert.deepEqual(verifyUnsubscribeToken(signUnsubscribeToken(address)), address);
});

test("連絡の鍵と回の id を載せられ、前に作った(載っていない)トークンも通る", () => {
  const linked = { recipientKey: USER, category: "marketing", channel: "email", messageKey: "shop.notice", dispatchId: DISPATCH };
  assert.deepEqual(verifyUnsubscribeToken(signUnsubscribeToken(linked)), linked);
  // 前の形(mk / d なし)= 同じ版のまま通り、結び付きは無い
  const old = verifyUnsubscribeToken(forge({ v: 1, r: USER, c: "marketing", ch: "email" }));
  assert.deepEqual(old, { recipientKey: USER, category: "marketing", channel: "email" });
  // 形の誤りは通さない・作らない
  assert.equal(verifyUnsubscribeToken(forge({ v: 1, r: USER, c: "marketing", ch: "email", mk: 5 })), null);
  assert.equal(verifyUnsubscribeToken(forge({ v: 1, r: USER, c: "marketing", ch: "email", d: "not-a-uuid" })), null);
  assert.equal(verifyUnsubscribeToken(forge({ v: 1, r: USER, c: "marketing", ch: "email", mk: "nodot" })), null);
  assert.throws(() => signUnsubscribeToken({ ...linked, dispatchId: "x" }));
});

test("改ざん・版の違い・形の誤り・別の鍵は通さない", () => {
  const token = signUnsubscribeToken({ recipientKey: USER, category: "marketing", channel: "email" });
  const [body, signature] = token.split(".");
  const otherBody = Buffer.from(JSON.stringify({ v: 1, r: USER, c: "activity", ch: "email" })).toString("base64url");
  assert.equal(verifyUnsubscribeToken(`${otherBody}.${signature}`), null);
  assert.equal(verifyUnsubscribeToken(`${body}.${signature.slice(0, -2)}AA`), null);
  assert.equal(verifyUnsubscribeToken(`${body}.`), null);
  assert.equal(verifyUnsubscribeToken(body), null);
  assert.equal(verifyUnsubscribeToken(`${token}.x`), null);
  assert.equal(verifyUnsubscribeToken(""), null);
  assert.equal(verifyUnsubscribeToken(null), null);
  assert.equal(verifyUnsubscribeToken(forge({ v: 2, r: USER, c: "marketing", ch: "email" })), null);
  assert.equal(verifyUnsubscribeToken(forge({ v: 1, r: "user:not-an-id", c: "marketing", ch: "email" })), null);
  assert.equal(verifyUnsubscribeToken(forge({ v: 1, r: USER, c: "", ch: "email" })), null);
  assert.equal(verifyUnsubscribeToken(forge({ v: 1, r: USER, c: "marketing", ch: "email", a: 5 })), null);
  assert.equal(verifyUnsubscribeToken(forge("not an object")), null);
  assert.equal(verifyUnsubscribeToken(forge({ v: 1, r: USER, c: "marketing", ch: "email" }, "other-secret")), null);
  assert.ok(verifyUnsubscribeToken(forge({ v: 1, r: USER, c: "marketing", ch: "email" })));
});

test("鍵が無い時は作れず、届いたトークンも通さない", () => {
  const token = signUnsubscribeToken({ recipientKey: USER, category: "marketing", channel: "email" });
  delete process.env[UNSUBSCRIBE_SECRET_ENV];
  assert.equal(isUnsubscribeConfigured(), false);
  assert.equal(verifyUnsubscribeToken(token), null);
  assert.throws(() => signUnsubscribeToken({ recipientKey: USER, category: "marketing", channel: "email" }));
  process.env[UNSUBSCRIBE_SECRET_ENV] = "  ";
  assert.equal(isUnsubscribeConfigured(), false);
});

test("中身の形が合わなければ作らない", () => {
  assert.throws(() => signUnsubscribeToken({ recipientKey: "user:x", category: "marketing", channel: "email" }));
  assert.throws(() => signUnsubscribeToken({ recipientKey: USER, category: "a b", channel: "email" }));
});

test("One-Click の URL はアプリの起点 + /api/messaging/unsubscribe?token=", () => {
  const url = new URL(buildUnsubscribeUrl({ recipientKey: USER, category: "marketing", channel: "email" }));
  assert.equal(url.origin, "https://app.example.test");
  assert.equal(url.pathname, "/api/messaging/unsubscribe");
  assert.equal(url.searchParams.get("t"), null, "古い引数の名前 t は使わない");
  assert.ok(verifyUnsubscribeToken(url.searchParams.get("token")));
});

test("ページの URL はアプリの起点 + /unsubscribe?token=、One-Click の URL から同じトークンで作れる", () => {
  const payload = { recipientKey: USER, category: "marketing", channel: "email" };
  const page = new URL(buildUnsubscribePageUrl(payload));
  assert.equal(page.origin, "https://app.example.test");
  assert.equal(page.pathname, "/unsubscribe");
  assert.ok(verifyUnsubscribeToken(page.searchParams.get("token")));
  const oneClick = buildUnsubscribeUrl(payload);
  const fromHeader = new URL(unsubscribePageUrlOf(`<${oneClick}>`)!);
  assert.equal(fromHeader.pathname, "/unsubscribe");
  assert.equal(fromHeader.searchParams.get("token"), new URL(oneClick).searchParams.get("token"));
  assert.equal(unsubscribePageUrlOf("not a url"), null);
  assert.equal(unsubscribePageUrlOf("https://app.example.test/api/messaging/unsubscribe"), null, "トークンが無い");
});

test("unsubscribePageUrlForToken: 字のままのトークンでページの URL、無ければ /unsubscribe だけ", () => {
  const page = new URL(unsubscribePageUrlForToken("abc.def"));
  assert.equal(page.origin, "https://app.example.test");
  assert.equal(page.pathname, "/unsubscribe");
  assert.equal(page.searchParams.get("token"), "abc.def");
  for (const token of [null, undefined, ""]) {
    const bare = new URL(unsubscribePageUrlForToken(token));
    assert.equal(bare.pathname, "/unsubscribe");
    assert.equal(bare.search, "");
  }
});
