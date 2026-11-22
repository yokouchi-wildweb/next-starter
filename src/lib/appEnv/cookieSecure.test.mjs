// src/lib/appEnv/cookieSecure.test.mjs — pnpm test src/lib/appEnv/cookieSecure.test.mjs
//
// cookie の secure の判定の一覧(README.md「cookie の secure」)。src の cookie を書く場所を全部ここに載せ、判定の形を縛る。
// - 形は 2 つだけ: 常に secure: true(セッションの共通オプション SESSION_COOKIE_BASE_OPTIONS)/ secure: !isDevelopment()(@/lib/appEnv)
// - NODE_ENV で判定しない
// - 一覧に無い cookie を書く場所(上流で足した物・fork が足した物)は、判定の形を持っていれば通り、無ければ落ちる
//   (この一覧は上流の物。fork は自分の cookie に判定を付けるだけで、ここには足さない)
// - 上流の公開の道具(ISSUERS)が返した cookie をそのまま cookies.set に渡すだけの場所は、その道具の判定で通る(上流・fork とも)

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

const ROOT = join(import.meta.dirname, "../../..");
const SRC = join(ROOT, "src");

const ALWAYS = "always"; // SESSION_COOKIE_BASE_OPTIONS(secure: true)
const NOT_DEV = "notDev"; // secure: !isDevelopment()
const CLEAR = "clientClear"; // ブラウザ側で消すだけ(max-age=0、値を書かない)

/**
 * cookie を書く場所 → 判定。新しい場所はここに足す
 * @type {Record<string, string>}
 */
const COOKIE_WRITERS = {
  "src/domains/core/auth/services/server/session/issueSessionCookie.ts": ALWAYS, // ログインのセッション
  "src/domains/core/auth/services/server/session/clearSessionCookie.ts": ALWAYS,
  "src/domains/core/pairedDevice/services/server/session/cookies.ts": ALWAYS, // 端末トークン・ペアリング待ち
  "src/lib/line/oauthState.ts": NOT_DEV, // LINE OAuth の nonce
  "src/app/api/auth/x/login/route.ts": NOT_DEV, // X OAuth の state / code verifier
  "src/domains/core/userAcquisition/plugs/proxyDecorators/attribution.ts": NOT_DEV, // 流入元
  "src/domains/core/referral/plugs/proxyDecorators/inviteLink.ts": NOT_DEV, // 招待リンク
  "src/lib/toast/redirect/server.ts": NOT_DEV, // 画面の通知の一時の cookie
  "src/lib/toast/redirect/cookie.ts": CLEAR, // 上の通知を読んだ後に消す
};

/**
 * 判定を持つ上流の公開の道具: その lib の入口から import して、返した値(value)を cookies.set(value) に渡すだけの場所は judgedIn の判定で通る
 * @type {{ name: string, value: string, judgedIn: string }[]}
 */
const ISSUERS = [
  { name: "issueOAuthState", value: "nonceCookie", judgedIn: "src/lib/line/oauthState.ts" }, // LINE OAuth の nonce
];

// 道具の lib の入口: src/lib/<name>/… の判定の場所 → その lib の入口の import 名
const entryOf = (/** @type {{ judgedIn: string }} */ issuer) => issuer.judgedIn.replace(/^src\/(lib\/[^/]+)\/.*$/, "@/$1");

const WRITES = /cookies\.set\(|document\.cookie\s*=|nonceCookie:|Set-Cookie/;

const stripComments = (/** @type {string} */ text) => text.replace(/^\s*(\/\/|\*).*$/gm, "");
const escape = (/** @type {string} */ text) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/**
 * 道具の値を cookies.set に渡すだけの場所なら、その道具を返す(ほかに cookie を書いていれば null)
 * @param {string} text
 */
function issuerOf(text) {
  const code = stripComments(text);
  return (
    ISSUERS.find(
      (issuer) =>
        new RegExp(`import \\{[^}]*\\b${issuer.name}\\b[^}]*\\} from "${escape(entryOf(issuer))}"`).test(code) &&
        new RegExp(`cookies\\.set\\(${issuer.value}\\)`).test(code) &&
        !WRITES.test(code.replace(new RegExp(`cookies\\.set\\(${issuer.value}\\)`, "g"), "")),
    ) ?? null
  );
}

/**
 * @param {string} dir
 * @param {string[]} [out]
 * @returns {string[]}
 */
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
    .filter((file) => WRITES.test(stripComments(readFileSync(file, "utf8"))))
    .map((file) => relative(ROOT, file));

const read = (/** @type {string} */ rel) => readFileSync(join(ROOT, rel), "utf8");

test("一覧の場所は今も cookie を書いている(消えた・移った場所を一覧に残さない)", () => {
  const found = new Set(writers());
  for (const rel of Object.keys(COOKIE_WRITERS)) assert.ok(found.has(rel), `${rel} は cookie を書いていない(一覧から外す・移し先に直す)`);
});

test("一覧に無い cookie を書く場所も判定を持つ: secure: !isDevelopment()(@/lib/appEnv)か SESSION_COOKIE_BASE_OPTIONS。NODE_ENV は使わない", () => {
  for (const rel of writers().filter((file) => !(file in COOKIE_WRITERS))) {
    const text = read(rel);
    if (issuerOf(text)) continue;
    assert.doesNotMatch(text, /NODE_ENV/, rel);
    assert.ok(/secure: !isDevelopment\(\)/.test(text) || /\.\.\.SESSION_COOKIE_BASE_OPTIONS/.test(text), `${rel}: cookie の secure の判定がありません(secure: !isDevelopment() を @/lib/appEnv から、またはセッションの共通オプション)`);
  }
});

test("判定の形: 常に secure(セッションの共通オプション)か !isDevelopment()(@/lib/appEnv)。NODE_ENV は使わない", () => {
  assert.match(read("src/domains/core/auth/constants/session.ts"), /secure: true,/);
  for (const [rel, judgment] of Object.entries(COOKIE_WRITERS)) {
    const text = read(rel);
    assert.doesNotMatch(text, /NODE_ENV/, rel);
    if (judgment === ALWAYS) assert.match(text, /\.\.\.SESSION_COOKIE_BASE_OPTIONS/, rel);
    else if (judgment === NOT_DEV) {
      assert.match(text, /secure: !isDevelopment\(\)/, rel);
      assert.match(text, /import \{[^}]*\bisDevelopment\b[^}]*\} from "@\/lib\/appEnv"/, rel);
      assert.doesNotMatch(text, /secure: (true|false)\b/, rel);
    } else if (judgment === CLEAR) assert.match(text, /document\.cookie = `[^`]*max-age=0`/, rel);
    else assert.fail(`${rel}: 知らない判定 ${judgment}`);
  }
});

test("道具の判定: ISSUERS の判定の場所は一覧にあり、道具の値を渡すだけの場所は通り、ほかにも書く場所は通らない", () => {
  for (const issuer of ISSUERS) assert.ok(COOKIE_WRITERS[issuer.judgedIn] === NOT_DEV || COOKIE_WRITERS[issuer.judgedIn] === ALWAYS, issuer.judgedIn);
  assert.equal(issuerOf(read("src/app/api/auth/line/login/route.ts"))?.name, "issueOAuthState", "上流の LINE のログインの口");
  const only = `import { issueOAuthState } from "${entryOf(ISSUERS[0])}";\nconst { nonceCookie } = issueOAuthState({});\nresponse.cookies.set(nonceCookie);\n`;
  assert.equal(issuerOf(only)?.name, "issueOAuthState");
  assert.equal(issuerOf(`${only}response.cookies.set("x", "1");\n`), null, "道具の値のほかにも書く");
  assert.equal(issuerOf(only.replace(`"${entryOf(ISSUERS[0])}"`, '"./mine"')), null, "上流の道具でない");
});
