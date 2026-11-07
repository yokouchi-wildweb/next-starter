// src/lib/line/oauthState.test.ts
//
// LINE OAuth の state と nonce cookie (issueOAuthState / verifyOAuthState) の検査 (LINE・DB なし)。
// - 発行した state を同じ cookie で照合すると ok と戻り先
// - nonce の不一致・cookie なし・state なし・壊れた state・別の cookie 名は ok false
// - 戻り先は同一オリジンのパスに sanitize される
// - cookie の属性 (httpOnly・lax・path・10 分・secure は段階が development 以外のとき)
// 実行: pnpm test:line-oauth-state
import { test } from "node:test";
import assert from "node:assert/strict";

import { withAppEnv } from "@/lib/appEnv";

import { LINE_OAUTH_NONCE_COOKIE } from "./constants";
import {
  issueOAuthState,
  LINE_OAUTH_STATE_MAX_AGE_SECONDS,
  verifyOAuthState,
} from "./oauthState";

const jar = (entries: Record<string, string>) => ({
  get: (name: string) => (name in entries ? { value: entries[name] } : undefined),
});

test("発行した state を同じ nonce の cookie で照合すると ok と戻り先", () => {
  const { state, nonceCookie } = issueOAuthState({ redirectAfter: "/mypage?tab=line" });

  assert.match(nonceCookie.value, /^[0-9a-f]{32}$/);
  const payload = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
  assert.deepEqual(payload, { nonce: nonceCookie.value, redirectAfter: "/mypage?tab=line" });

  const result = verifyOAuthState({
    state,
    cookies: jar({ [nonceCookie.name]: nonceCookie.value }),
  });
  assert.deepEqual(result, { ok: true, redirectAfter: "/mypage?tab=line" });
});

test("nonce は毎回違う", () => {
  const a = issueOAuthState({ redirectAfter: "/" });
  const b = issueOAuthState({ redirectAfter: "/" });
  assert.notEqual(a.nonceCookie.value, b.nonceCookie.value);
});

test("不一致・cookie なし・state なし・壊れた state は ok false", () => {
  const { state, nonceCookie } = issueOAuthState({ redirectAfter: "/mypage" });

  assert.deepEqual(verifyOAuthState({ state, cookies: jar({ [nonceCookie.name]: "other" }) }), { ok: false });
  assert.deepEqual(verifyOAuthState({ state, cookies: jar({}) }), { ok: false });
  assert.deepEqual(
    verifyOAuthState({ state: null, cookies: jar({ [nonceCookie.name]: nonceCookie.value }) }),
    { ok: false },
  );
  assert.deepEqual(
    verifyOAuthState({ state: "%%%not-base64-json", cookies: jar({ [nonceCookie.name]: nonceCookie.value }) }),
    { ok: false },
  );
  const noNonce = Buffer.from(JSON.stringify({ redirectAfter: "/x" })).toString("base64url");
  assert.deepEqual(verifyOAuthState({ state: noNonce, cookies: jar({ [nonceCookie.name]: "" }) }), { ok: false });
});

test("cookie 名: 既定は LINE_OAUTH_NONCE_COOKIE、別の名前は同じ名前でだけ照合できる", () => {
  const linkFlow = issueOAuthState({ redirectAfter: "/" });
  assert.equal(linkFlow.nonceCookie.name, LINE_OAUTH_NONCE_COOKIE);

  const signIn = issueOAuthState({ redirectAfter: "/", cookieName: "__line_signin_nonce" });
  assert.equal(signIn.nonceCookie.name, "__line_signin_nonce");

  const cookies = jar({ __line_signin_nonce: signIn.nonceCookie.value });
  assert.deepEqual(verifyOAuthState({ state: signIn.state, cookies }), { ok: false });
  assert.deepEqual(
    verifyOAuthState({ state: signIn.state, cookies, cookieName: "__line_signin_nonce" }),
    { ok: true, redirectAfter: "/" },
  );
});

test("戻り先は同一オリジンのパスに sanitize される (外は '/')", () => {
  for (const redirectAfter of ["https://evil.example/", "//evil.example", "javascript:alert(1)"]) {
    const { state, nonceCookie } = issueOAuthState({ redirectAfter });
    const result = verifyOAuthState({ state, cookies: jar({ [nonceCookie.name]: nonceCookie.value }) });
    assert.deepEqual(result, { ok: true, redirectAfter: "/" }, redirectAfter);
  }
});

test("cookie の属性: httpOnly・lax・path / ・10 分、secure は段階が development 以外のとき", () => {
  withAppEnv("development", () => {
    const dev = issueOAuthState({ redirectAfter: "/" }).nonceCookie;
    assert.equal(dev.httpOnly, true);
    assert.equal(dev.sameSite, "lax");
    assert.equal(dev.path, "/");
    assert.equal(dev.maxAge, 600);
    assert.equal(LINE_OAUTH_STATE_MAX_AGE_SECONDS, 600);
    assert.equal(dev.secure, false);
  });
  withAppEnv("staging", () => {
    assert.equal(issueOAuthState({ redirectAfter: "/" }).nonceCookie.secure, true);
  });
  withAppEnv("production", () => {
    assert.equal(issueOAuthState({ redirectAfter: "/" }).nonceCookie.secure, true);
  });
});
