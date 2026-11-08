// src/lib/appEnv/cookieSecure.test.mjs — pnpm test src/lib/appEnv/cookieSecure.test.mjs
//
// cookie の secure の判定の一覧(README.md「cookie の secure」)。src の cookie を書く場所を全部ここに載せ、判定の形を縛る。
// - 形は 2 つだけ: 常に secure: true(セッションの共通オプション SESSION_COOKIE_BASE_OPTIONS)/ secure: !isDevelopment()(@/lib/appEnv)
// - NODE_ENV で判定しない
// - 一覧に無い cookie を書く場所が増えたら落ちる(判定を決めて一覧に足す)

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

const ROOT = join(import.meta.dirname, "../../..");
const SRC = join(ROOT, "src");

const ALWAYS = "always"; // SESSION_COOKIE_BASE_OPTIONS(secure: true)
const NOT_DEV = "notDev"; // secure: !isDevelopment()
const VIA = (file) => ({ via: file }); // 判定は別のファイル(その行も一覧にある)
const CLEAR = "clientClear"; // ブラウザ側で消すだけ(max-age=0、値を書かない)

/** cookie を書く場所 → 判定。新しい場所はここに足す */
const COOKIE_WRITERS = {
  "src/features/core/auth/services/server/session/issueSessionCookie.ts": ALWAYS, // ログインのセッション
  "src/features/core/auth/services/server/session/clearSessionCookie.ts": ALWAYS,
  "src/features/core/pairedDevice/services/server/session/cookies.ts": ALWAYS, // 端末トークン・ペアリング待ち
  "src/lib/line/oauthState.ts": NOT_DEV, // LINE OAuth の nonce
  "src/app/api/auth/line/login/route.ts": VIA("src/lib/line/oauthState.ts"),
  "src/app/api/auth/x/login/route.ts": NOT_DEV, // X OAuth の state / code verifier
  "src/proxies/attribution.ts": NOT_DEV, // 流入元
  "src/proxies/inviteLink.ts": NOT_DEV, // 招待リンク
  "src/lib/toast/redirect/server.ts": NOT_DEV, // 画面の通知の一時の cookie
  "src/lib/toast/redirect/cookie.ts": CLEAR, // 上の通知を読んだ後に消す
};

const WRITES = /cookies\.set\(|document\.cookie\s*=|nonceCookie:|Set-Cookie/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mts|mjs)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
  }
  return out;
}

const writers = () =>
  walk(SRC)
    .filter((file) => WRITES.test(readFileSync(file, "utf8").replace(/^\s*(\/\/|\*).*$/gm, "")))
    .map((file) => relative(ROOT, file));

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

test("cookie を書く場所は全部一覧にある(増えたら判定を決めて COOKIE_WRITERS に足す)", () => {
  assert.deepEqual(writers().sort(), Object.keys(COOKIE_WRITERS).sort());
});

test("判定の形: 常に secure(セッションの共通オプション)か !isDevelopment()(@/lib/appEnv)。NODE_ENV は使わない", () => {
  assert.match(read("src/features/core/auth/constants/session.ts"), /secure: true,/);
  for (const [rel, judgment] of Object.entries(COOKIE_WRITERS)) {
    const text = read(rel);
    assert.doesNotMatch(text, /NODE_ENV/, rel);
    if (judgment === ALWAYS) assert.match(text, /\.\.\.SESSION_COOKIE_BASE_OPTIONS/, rel);
    else if (judgment === NOT_DEV) {
      assert.match(text, /secure: !isDevelopment\(\)/, rel);
      assert.match(text, /import \{[^}]*\bisDevelopment\b[^}]*\} from "@\/lib\/appEnv"/, rel);
      assert.doesNotMatch(text, /secure: (true|false)\b/, rel);
    } else if (judgment === CLEAR) assert.match(text, /document\.cookie = `[^`]*max-age=0`/, rel);
    else assert.ok(COOKIE_WRITERS[judgment.via] === NOT_DEV || COOKIE_WRITERS[judgment.via] === ALWAYS, rel);
  }
});
