// src/lib/line/oauth.test.ts
//
// LINE 連携のコールバック処理(processCallback)の検査(外部通信なし。fetch と設定を偽物に差し替える)。
// - code → token → id_token の検証 → 友だちの状態を順に呼び、連携に要る値だけを返す(プロフィール画像は返さない)
// 実行: pnpm test src/lib/line/oauth.test.ts
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { after, before, mock, test } from "node:test";
import assert from "node:assert/strict";

mock.module("./env", {
  namedExports: { getLineLoginConfig: () => ({ channelId: "cid", channelSecret: "secret" }) },
});

const calls: string[] = [];
const realFetch = globalThis.fetch;
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

let processCallback: typeof import("./oauth").processCallback;
before(async () => {
  globalThis.fetch = (async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/oauth2/v2.1/token")) return json({ access_token: "at", id_token: "idt" });
    if (url.endsWith("/oauth2/v2.1/verify")) {
      return json({ sub: "L1", name: "たろう", picture: "https://profile.line-scdn.net/x", email: "a@example.com" });
    }
    if (url.endsWith("/friendship/v1/status")) return json({ friendFlag: true });
    throw new Error(`unexpected fetch: ${url}`);
  }) as typeof fetch;
  ({ processCallback } = await import("./oauth"));
});
after(() => {
  globalThis.fetch = realFetch;
});

test("連携に要る値だけを返す(id_token に画像があっても返さない)", async () => {
  const result = await processCallback("code", "https://app.example/api/auth/line/callback", false);
  assert.deepEqual(result, {
    lineUserId: "L1",
    displayName: "たろう",
    friendshipStatusChanged: false,
    isFriend: true,
  });
  assert.equal(calls.length, 3);
});
