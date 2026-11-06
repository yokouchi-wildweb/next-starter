// scripts/tasks/dev-admin.test.ts
//
// dev-admin の純粋な部品: パスワードが秘密から決まること、開発環境以外で止まること(DB には触らない)。

import assert from "node:assert/strict";
import { test } from "node:test";

import { devAdminPassword, notDevelopmentReason } from "./dev-admin";

test("devAdminPassword: 同じ秘密なら同じ値、違う秘密なら違う値", () => {
  const a = devAdminPassword("secret-a");
  assert.equal(a, devAdminPassword("secret-a"));
  assert.notEqual(a, devAdminPassword("secret-b"));
  assert.match(a, /^[A-Za-z0-9]{24}-A1$/);
});

test("notDevelopmentReason: 本番・別の env・秘密なしで止まり、開発環境なら null", () => {
  const base = { AUTH_JWT_SECRET: "s" } as unknown as NodeJS.ProcessEnv;
  assert.equal(notDevelopmentReason({ ...base, APP_ENV: ".env.development" }), null);
  assert.equal(notDevelopmentReason({ ...base, APP_ENV: ".env.development.local" }), null);
  assert.equal(notDevelopmentReason({ ...base }), null);
  assert.match(notDevelopmentReason({ ...base, NODE_ENV: "production" }) ?? "", /production/);
  assert.match(notDevelopmentReason({ ...base, APP_ENV: ".env.production" }) ?? "", /APP_ENV/);
  assert.match(notDevelopmentReason({ APP_ENV: ".env.development" } as unknown as NodeJS.ProcessEnv) ?? "", /AUTH_JWT_SECRET/);
});
