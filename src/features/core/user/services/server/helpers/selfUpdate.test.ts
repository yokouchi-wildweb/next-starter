// src/features/core/user/services/server/helpers/selfUpdate.test.ts
// 実行: pnpm test:user-self-update

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { assertSelfUpdateAllowed, selfUpdateSchema } from "./selfUpdate";

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
