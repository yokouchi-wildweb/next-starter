// src/features/core/user/services/server/helpers/passwordChange.test.ts
// planPasswordChange の単体テスト (newPassword → プロバイダー別書き込み先の写像)
// 実行: pnpm test:user-password-change

import { test } from "node:test";
import assert from "node:assert/strict";
import { planPasswordChange } from "./passwordChange";
import { DomainError } from "@/lib/errors/domainError";

test("local ユーザー: newPassword は localPassword へ写像される (回帰: 無言 no-op 防止)", () => {
  const plan = planPasswordChange({ providerType: "local", newPassword: "  secret123  " });
  assert.deepEqual(plan, { localPassword: "secret123" });
});

test("email ユーザー: newPassword は Firebase 同期へ写像される", () => {
  const plan = planPasswordChange({ providerType: "email", newPassword: "secret123" });
  assert.deepEqual(plan, { firebasePassword: "secret123" });
});

test("newPassword 未指定/空文字/空白のみ: 何もしない (どのプロバイダーでもエラーにしない)", () => {
  assert.deepEqual(planPasswordChange({ providerType: "local" }), {});
  assert.deepEqual(planPasswordChange({ providerType: "local", newPassword: null }), {});
  assert.deepEqual(planPasswordChange({ providerType: "email", newPassword: "" }), {});
  assert.deepEqual(planPasswordChange({ providerType: "google.com", newPassword: "   " }), {});
});

test("パスワード経路の無いプロバイダーに newPassword: DomainError 400 (fail loud)", () => {
  for (const providerType of ["google.com", "line", "apple", "oidc", "saml", "custom"] as const) {
    assert.throws(
      () => planPasswordChange({ providerType, newPassword: "secret123" }),
      (error: unknown) => error instanceof DomainError && error.status === 400,
      `providerType=${providerType} は 400 で拒否されるべき`,
    );
  }
});
