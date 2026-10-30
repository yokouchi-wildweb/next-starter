// src/features/core/user/services/server/helpers/selfUpdate.test.ts
// 実行: pnpm test:user-self-update

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { z } from "zod";

import { USER_UPDATE_VALIDATION } from "@/config/app/user-update.config";
import { UserSelfUpdateSchema } from "@/features/core/user/entities";

import { assertSelfUpdateAllowed, selfUpdateSchema } from "./selfUpdate";
import { userFacingValidationMessage } from "./validationMessage";

const admin = { userId: "a", role: "admin" };
const member = { userId: "u", role: "user" };

test("非管理者のローカル認証は 400、管理者とほかのプロバイダーは通す", () => {
  assert.throws(() => assertSelfUpdateAllowed(member, "local"), (e: { status?: number }) => e.status === 400);
  assert.doesNotThrow(() => assertSelfUpdateAllowed(member, "email"));
  assert.doesNotThrow(() => assertSelfUpdateAllowed(admin, "local"));
});

test("本人のスキーマは管理者専用の項目を落とす", async () => {
  const parsed = await selfUpdateSchema(member).parseAsync({ role: "admin", name: "n" });
  assert.equal("role" in parsed, false);
  const byAdmin = await selfUpdateSchema(admin).parseAsync({ role: "admin" });
  assert.equal((byAdmin as { role?: string }).role, "admin");
});

test("update はセッションを読まない", () => {
  const text = readFileSync(resolve(import.meta.dirname, "../wrappers/update.ts"), "utf8");
  assert.doesNotMatch(text, /auth\/services\/server\/session\//);
});

test("検証の文: Zod の既定の文は固定文、スキーマが書いた文はそのまま", async () => {
  const fallback = USER_UPDATE_VALIDATION.fallbackMessage;
  const issueOf = (schema: z.ZodTypeAny, value: unknown) => {
    const result = schema.safeParse(value);
    assert.equal(result.success, false);
    return (result as z.SafeParseError<unknown>).error.errors[0];
  };
  assert.equal(userFacingValidationMessage(issueOf(z.string().url(), "x"), fallback), fallback);
  assert.equal(userFacingValidationMessage(issueOf(z.string().email(), "x"), fallback), fallback);
  assert.equal(userFacingValidationMessage(issueOf(z.string(), 1), fallback), fallback);
  assert.equal(userFacingValidationMessage(issueOf(z.string().min(3), "x"), fallback), fallback);
  assert.equal(userFacingValidationMessage(issueOf(z.string().refine(() => false), "x"), fallback), fallback);
  assert.equal(userFacingValidationMessage(issueOf(z.string().min(3, { message: "短い" }), "x"), fallback), "短い");
  assert.equal(userFacingValidationMessage(undefined, fallback), fallback);
  const email = await UserSelfUpdateSchema.safeParseAsync({ email: "x" });
  assert.equal(userFacingValidationMessage(email.error?.errors[0], fallback), fallback);
  const name = await UserSelfUpdateSchema.safeParseAsync({ name: "a\u0000" });
  assert.match(userFacingValidationMessage(name.error?.errors[0], fallback), /表示名/);
});
