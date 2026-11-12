// scripts/workflow/dev-admin/dev-admin.test.ts
//
// dev-admin の純粋な部品: パスワードが秘密から決まること、開発環境以外で止まること(DB には触らない)。

import assert from "node:assert/strict";
import { test } from "node:test";

import { DEV_ADMIN_EMAIL, checkResult, devAdminPassword, notDevelopmentReason } from "./lib";

test("devAdminPassword: 同じ秘密なら同じ値、違う秘密なら違う値", () => {
  const a = devAdminPassword("secret-a");
  assert.equal(a, devAdminPassword("secret-a"));
  assert.notEqual(a, devAdminPassword("secret-b"));
  assert.match(a, /^[A-Za-z0-9]{24}-A1$/);
});

test("notDevelopmentReason: 本番・別の env・秘密なしで止まり、開発環境なら null", () => {
  const base = { AUTH_JWT_SECRET: "s", APP_ENV: "development" } as unknown as NodeJS.ProcessEnv;
  assert.equal(notDevelopmentReason({ ...base, ENV_FILE: ".env.development" }), null);
  assert.equal(notDevelopmentReason({ ...base, ENV_FILE: ".env.development.local" }), null);
  assert.equal(notDevelopmentReason({ ...base }), null);
  assert.match(notDevelopmentReason({ ...base, APP_ENV: "production" }) ?? "", /production/);
  assert.match(notDevelopmentReason({ ...base, APP_ENV: "staging" }) ?? "", /staging/);
  assert.match(notDevelopmentReason({ ...base, APP_ENV: undefined }) ?? "", /production/);
  assert.match(notDevelopmentReason({ ...base, ENV_FILE: ".env.production" }) ?? "", /ENV_FILE/);
  assert.match(notDevelopmentReason({ APP_ENV: "development" } as unknown as NodeJS.ProcessEnv) ?? "", /AUTH_JWT_SECRET/);
});

test("checkResult(--check の答え): いる / いない(無い・論理削除済み)、パスワードは出さない", () => {
  assert.deepEqual(checkResult({ deletedAt: null }), { action: "check", present: true, email: DEV_ADMIN_EMAIL });
  assert.equal(checkResult(null).present, false);
  assert.equal(checkResult(undefined).present, false);
  assert.equal(checkResult({ deletedAt: new Date() }).present, false);
  assert.equal("password" in checkResult({ deletedAt: null }), false);
});
