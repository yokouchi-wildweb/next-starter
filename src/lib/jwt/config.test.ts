// src/lib/jwt/config.test.ts
// JWT セッションの設定の上書きが cookie 名・既定の有効期限に効くことのテスト。実行: pnpm test src/lib/jwt (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";

import { jwtConfig, jwtConfigDef } from "./config";
import { SESSION_COOKIE_NAME, SESSION_DEFAULT_MAX_AGE_SECONDS } from "./constants";

// 上流の既定は compose({}) で見る(読み込んだ jwtConfig は fork が src/config/lib/jwt.config.ts に書いた値で変わる)
test("上流の空の上書きでは既定のまま", () => {
  assert.deepEqual(jwtConfigDef.compose({}), { cookieName: "__session", defaultMaxAgeSeconds: 604800 });
});

test("公開の定数は読み込んだ設定(@lib-config/jwt)の値", () => {
  assert.equal(SESSION_COOKIE_NAME, jwtConfig.cookieName);
  assert.equal(SESSION_DEFAULT_MAX_AGE_SECONDS, jwtConfig.defaultMaxAgeSeconds);
});

test("上書きの値が cookie 名・有効期限に効き、書かないキーは既定のまま", () => {
  const config = jwtConfigDef.compose({ cookieName: "__myapp_session" });
  assert.equal(config.cookieName, "__myapp_session");
  assert.equal(config.defaultMaxAgeSeconds, 604800);
  assert.equal(jwtConfigDef.compose({ defaultMaxAgeSeconds: 3600 }).defaultMaxAgeSeconds, 3600);
});
