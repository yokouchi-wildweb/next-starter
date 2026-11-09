// src/lib/jwt/config.test.ts
// JWT セッションの設定の上書きが cookie 名・既定の有効期限に効くことのテスト。実行: pnpm test src/lib/jwt (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";

import { jwtConfig, jwtConfigDef } from "./config";
import { SESSION_COOKIE_NAME, SESSION_DEFAULT_MAX_AGE_SECONDS } from "./constants";

test("上流の空の上書き(@lib-config/jwt)では既定のまま、公開の定数はその値", () => {
  assert.deepEqual(jwtConfig, { cookieName: "__session", defaultMaxAgeSeconds: 604800 });
  assert.equal(SESSION_COOKIE_NAME, "__session");
  assert.equal(SESSION_DEFAULT_MAX_AGE_SECONDS, 604800);
});

test("上書きの値が cookie 名・有効期限に効き、書かないキーは既定のまま", () => {
  const config = jwtConfigDef.compose({ cookieName: "__myapp_session" });
  assert.equal(config.cookieName, "__myapp_session");
  assert.equal(config.defaultMaxAgeSeconds, 604800);
  assert.equal(jwtConfigDef.compose({ defaultMaxAgeSeconds: 3600 }).defaultMaxAgeSeconds, 3600);
});
