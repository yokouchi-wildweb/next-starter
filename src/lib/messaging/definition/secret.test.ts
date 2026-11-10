// vars の秘密の印(secretVar / isSecretVar / listSecretVarKeys)
// 実行: pnpm test src/lib/messaging/definition/secret.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import { isSecretVar, listSecretVarKeys, secretVar } from "./secret";

test("印を付けた値は秘密、付けない値は秘密でない", () => {
  assert.equal(isSecretVar(secretVar(z.string())), true);
  assert.equal(isSecretVar(z.string()), false);
});

test("後から包んでも内側の印を見る(optional・nullable・default・refine)", () => {
  assert.equal(isSecretVar(secretVar(z.string()).optional()), true);
  assert.equal(isSecretVar(secretVar(z.string()).nullable()), true);
  assert.equal(isSecretVar(secretVar(z.string()).default("x")), true);
  assert.equal(isSecretVar(secretVar(z.string()).refine((v) => v.length > 0)), true);
});

test("値の型と検査はそのまま", () => {
  const schema = secretVar(z.string().url());
  assert.equal(schema.safeParse("https://example.com/x").success, true);
  assert.equal(schema.safeParse("not a url").success, false);
});

test("vars の object から秘密の鍵を集める", () => {
  const vars = z.object({
    resetUrl: secretVar(z.string().url()),
    code: secretVar(z.string()).optional(),
    name: z.string(),
  });
  assert.deepEqual(listSecretVarKeys(vars).sort(), ["code", "resetUrl"]);
});
