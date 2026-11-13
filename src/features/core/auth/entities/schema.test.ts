// src/features/core/auth/entities/schema.test.ts
// 本登録のスキーマの宣伝の同意(marketingConsent)の検査: 省略可の boolean(D88)
// 実行: pnpm test src/features/core/auth/entities/schema.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { RegistrationSchema } from "./schema";

const base = {
  providerType: "email",
  providerUid: "uid-1",
  email: "a@example.com",
  name: "taro",
  idToken: "id-token",
  password: "password123",
};

test("marketingConsent は省略可の boolean", () => {
  assert.equal(RegistrationSchema.safeParse(base).success, true);
  assert.equal(RegistrationSchema.safeParse(base).data?.marketingConsent, undefined);
  for (const value of [true, false]) {
    const parsed = RegistrationSchema.safeParse({ ...base, marketingConsent: value });
    assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues));
    assert.equal(parsed.data?.marketingConsent, value);
  }
  assert.equal(RegistrationSchema.safeParse({ ...base, marketingConsent: "false" }).success, false);
});
